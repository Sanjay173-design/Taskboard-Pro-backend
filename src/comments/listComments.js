const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { res } = require("../utils/response");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

module.exports.listComments = async (event) => {
  try {
    const claims = event.requestContext.authorizer.jwt.claims;
    const taskId = event.queryStringParameters?.taskId;

    if (!taskId) {
      return res(400, { error: "taskId is required" });
    }

    const result = await docClient.send(
      new ScanCommand({
        TableName: "TaskComments",
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
    return res(500, { error: "Failed to fetch comments" });
  }
};
