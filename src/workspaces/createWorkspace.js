const redis = require("../utils/redis");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { res } = require("../utils/response");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

module.exports.createWorkspace = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    // 👇 Read user identity from JWT
    const claims = event.requestContext.authorizer.jwt.claims;

    if (!body.name) {
      return res(400, { error: "Workspace name is required" });
    }

    const item = {
      workspaceId: randomUUID(),
      name: body.name,
      description: body.description || "",
      ownerId: claims.sub,
      createdAt: new Date().toISOString(),
    };

    // ✅ 1️⃣ Write to DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: "Workspaces",
        Item: item,
      }),
    );

    // 🔥 2️⃣ Invalidate workspaces cache (AFTER successful DB write)
    try {
      const cacheKey = `workspaces:${claims.sub}`;
      await redis.del(cacheKey);
      console.log("CACHE INVALIDATED (workspaces)");
    } catch (err) {
      console.warn("Cache invalidation failed (workspaces):", err.message);
    }

    // ✅ 3️⃣ Return response
    return res(201, item);
  } catch (err) {
    console.error("Error:", err);
    return res(500, { error: "Failed to create workspace" });
  }
};
