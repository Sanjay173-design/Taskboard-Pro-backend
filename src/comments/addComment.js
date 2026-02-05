const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { res } = require("../utils/response");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

module.exports.addComment = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const claims = event.requestContext.authorizer.jwt.claims;

    if (!body.taskId || !body.message) {
      return res(400, { error: "taskId and message are required" });
    }

    const comment = {
      commentId: randomUUID(),
      taskId: body.taskId,
      message: body.message,
      ownerId: claims.sub,
      createdAt: new Date().toISOString(),
    };

    // Save comment
    await docClient.send(
      new PutCommand({
        TableName: "TaskComments",
        Item: comment,
      })
    );

    // Create activity entry
    const activity = {
      activityId: randomUUID(),
      taskId: body.taskId,
      type: "comment_added",
      message: `Commented on task`,
      ownerId: claims.sub,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: "TaskActivity",
        Item: activity,
      })
    );

    return res(201, comment);
  } catch (err) {
    console.error(err);
    return res(500, { error: "Failed to add comment" });
  }
};
