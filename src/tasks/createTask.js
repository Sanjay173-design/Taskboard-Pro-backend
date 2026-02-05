const redis = require("../utils/redis");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { res } = require("../utils/response");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

module.exports.createTask = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const claims = event.requestContext?.authorizer?.jwt?.claims || {
      sub: "OFFLINE-USER",
    };

    if (!body.projectId || !body.title) {
      return res(400, { error: "projectId and title are required" });
    }

    const item = {
      taskId: randomUUID(),
      projectId: body.projectId,
      title: body.title,
      description: body.description || "",
      status: "todo",
      priority: body.priority || "medium",
      ownerId: claims.sub,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1️⃣ Save task
    await docClient.send(
      new PutCommand({
        TableName: "Tasks",
        Item: item,
      }),
    );

    // 🔥 Invalidate tasks cache
    try {
      const cacheKey = `tasks:${claims.sub}:${projectId}`;
      await redis.del(cacheKey);
      console.log("CACHE INVALIDATED (tasks)");
    } catch (err) {
      console.warn("Cache invalidation failed (tasks):", err.message);
    }

    // 2️⃣ Add activity
    await docClient.send(
      new PutCommand({
        TableName: "TaskActivity",
        Item: {
          activityId: randomUUID(),
          taskId: item.taskId,
          type: "task_created",
          message: "Task created",
          ownerId: claims.sub,
          createdAt: new Date().toISOString(),
        },
      }),
    );

    // 3️⃣ Invalidate Redis cache (ONLY if redis exists)
    const cacheKey = `tasks:${claims.sub}:${body.projectId}`;
    if (redis) {
      try {
        await redis.del(cacheKey);
        console.log("CACHE INVALIDATED:", cacheKey);
      } catch (cacheErr) {
        console.warn("Redis cache invalidation failed:", cacheErr.message);
      }
    }

    return res(201, item);
  } catch (err) {
    console.error("createTask failed:", err);
    return res(500, { error: "Failed to create task" });
  }
};
