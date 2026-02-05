const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  UpdateCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

const { randomUUID } = require("crypto");
const { res } = require("../utils/response");
const redis = require("../utils/redis");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

module.exports.updateTaskStatus = async (event) => {
  try {
    /* ---------------- AUTH ---------------- */

    const claims = event.requestContext?.authorizer?.jwt?.claims || {
      sub: "OFFLINE-USER",
    };

    /* ---------------- PATH PARAM ---------------- */

    const taskId = event.pathParameters?.taskId;

    /* ---------------- BODY ---------------- */

    const body = JSON.parse(event.body || "{}");
    const { status, title, description, priority, dueDate, projectId } = body;

    /* ---------------- VALIDATION ---------------- */

    if (!taskId || !projectId) {
      return res(400, {
        error: "taskId (path) and projectId (body) are required",
      });
    }

    if (
      status === undefined &&
      title === undefined &&
      description === undefined &&
      priority === undefined &&
      dueDate === undefined
    ) {
      return res(400, {
        error:
          "Provide at least one of: status, title, description, priority, dueDate",
      });
    }

    if (status !== undefined) {
      const allowed = ["todo", "in_progress", "done"];
      if (!allowed.includes(status)) {
        return res(400, { error: "Invalid status value" });
      }
    }

    /* ---------------- BUILD DYNAMIC UPDATE ---------------- */

    let updateExpression = "SET updatedAt = :t";
    const names = {};
    const values = {
      ":t": new Date().toISOString(),
      ":uid": claims.sub,
    };

    if (status !== undefined) {
      updateExpression += ", #s = :s";
      names["#s"] = "status";
      values[":s"] = status;
    }

    if (title !== undefined) {
      updateExpression += ", #title = :title";
      names["#title"] = "title";
      values[":title"] = title;
    }

    if (description !== undefined) {
      updateExpression += ", #desc = :desc";
      names["#desc"] = "description";
      values[":desc"] = description;
    }

    if (priority !== undefined) {
      updateExpression += ", #priority = :priority";
      names["#priority"] = "priority";
      values[":priority"] = priority;
    }

    if (dueDate !== undefined) {
      updateExpression += ", #dueDate = :dueDate";
      names["#dueDate"] = "dueDate";
      values[":dueDate"] = dueDate;
    }

    /* ---------------- UPDATE DYNAMODB ---------------- */

    await docClient.send(
      new UpdateCommand({
        TableName: "Tasks",
        Key: { taskId },
        UpdateExpression: updateExpression,
        ConditionExpression: "ownerId = :uid",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );

    /* ---------------- REDIS CACHE INVALIDATION ---------------- */

    try {
      if (redis) {
        const cacheKey = `tasks:${claims.sub}:${projectId}`;
        await redis.del(cacheKey);
        console.log("CACHE INVALIDATED:", cacheKey);
      }
    } catch (cacheErr) {
      console.warn("Redis cache invalidation failed:", cacheErr.message);
    }

    /* ---------------- ACTIVITY LOG ---------------- */

    let activityType = "task_updated";
    let activityMessage = "Task updated";

    if (status !== undefined) {
      activityType = "status_changed";
      activityMessage = `Moved to ${status}`;
    } else if (title !== undefined) {
      activityType = "title_updated";
      activityMessage = `Title updated to "${title}"`;
    } else if (description !== undefined) {
      activityType = "description_updated";
      activityMessage = "Description updated";
    } else if (priority !== undefined) {
      activityType = "priority_updated";
      activityMessage = `Priority set to ${priority}`;
    } else if (dueDate !== undefined) {
      activityType = "due_date_updated";
      activityMessage = `Due date set to ${dueDate}`;
    }

    await docClient.send(
      new PutCommand({
        TableName: "TaskActivity",
        Item: {
          activityId: randomUUID(),
          taskId,
          type: activityType,
          message: activityMessage,
          ownerId: claims.sub,
          createdAt: new Date().toISOString(),
        },
      }),
    );

    /* ---------------- SUCCESS ---------------- */

    return res(200, { success: true });
  } catch (err) {
    console.error("updateTaskStatus failed:", err);
    return res(500, { error: "Failed to update task" });
  }
};
