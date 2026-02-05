const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { res } = require("../utils/response");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.listAttachments = async (event) => {
  try {
    const claims = event.requestContext.authorizer.jwt.claims;
    const taskId = event.queryStringParameters?.taskId;

    if (!taskId) return res(400, { error: "taskId is required" });

    const result = await ddb.send(
      new ScanCommand({
        TableName: "TaskAttachments",
        FilterExpression: "taskId = :tid AND ownerId = :uid",
        ExpressionAttributeValues: {
          ":tid": taskId,
          ":uid": claims.sub,
        },
      })
    );

    return res(200, result.Items || []);
  } catch (err) {
    console.error(err);
    return res(500, { error: "Failed to fetch attachments" });
  }
};
