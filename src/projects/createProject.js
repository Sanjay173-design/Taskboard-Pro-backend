const redis = require("../utils/redis");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { res } = require("../utils/response");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

module.exports.createProject = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const claims = event.requestContext.authorizer.jwt.claims;

    if (!body.workspaceId || !body.name) {
      return res(400, { error: "workspaceId and name are required" });
    }

    const item = {
      projectId: randomUUID(),
      workspaceId: body.workspaceId,
      name: body.name,
      description: body.description || "",
      ownerId: claims.sub,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: "Projects",
        Item: item,
      }),
    );

    // 🔥 Invalidate projects cache
    try {
      if (redis) {
        const cacheKey = `projects:${claims.sub}:${body.workspaceId}`;
        await redis.del(cacheKey);
        console.log("CACHE INVALIDATED (projects):", cacheKey);
      }
    } catch (err) {
      console.warn("Cache invalidation failed (projects):", err.message);
    }

    return res(201, item);
  } catch (err) {
    console.error(err);
    return res(500, { error: "Failed to create project" });
  }
};
