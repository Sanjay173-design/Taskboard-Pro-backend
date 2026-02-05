const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { res } = require("../utils/response");

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const BUCKET = "taskboard-attachments-yourname"; // update

module.exports.deleteAttachment = async (event) => {
  try {
    const claims = event.requestContext.authorizer.jwt.claims;
    const body = JSON.parse(event.body || "{}");
    const { attachmentId, taskId } = body;

    if (!attachmentId || !taskId)
      return res(400, { error: "attachmentId and taskId are required" });

    // Fetch metadata
    const { Item } = await ddb.send(
      new GetCommand({
        TableName: "TaskAttachments",
        Key: { attachmentId },
      })
    );

    if (!Item) return res(404, { error: "Attachment not found" });

    if (Item.ownerId !== claims.sub)
      return res(403, { error: "Access denied" });

    // Delete from S3
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: Item.key,
      })
    );

    // Delete metadata
    await ddb.send(
      new DeleteCommand({
        TableName: "TaskAttachments",
        Key: { attachmentId },
      })
    );

    // Add activity event
    await ddb.send(
      new PutCommand({
        TableName: "TaskActivity",
        Item: {
          activityId: randomUUID(),
          taskId,
          type: "attachment_deleted",
          message: `Deleted file ${Item.fileName}`,
          ownerId: claims.sub,
          createdAt: new Date().toISOString(),
        },
      })
    );

    return res(200, { success: true });
  } catch (err) {
    console.error(err);
    return res(500, { error: "Failed to delete attachment" });
  }
};
