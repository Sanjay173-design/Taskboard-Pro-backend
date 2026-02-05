const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");
const { res } = require("../utils/response");

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const BUCKET = "taskboard-attachments-yourname"; // <-- update

module.exports.getUploadUrl = async (event) => {
  try {
    const claims = event.requestContext.authorizer.jwt.claims;
    const body = JSON.parse(event.body || "{}");

    const { taskId, fileName, contentType } = body;

    if (!taskId || !fileName || !contentType) {
      return res(400, { error: "taskId, fileName, contentType required" });
    }

    const attachmentId = randomUUID();
    const key = `tasks/${taskId}/${attachmentId}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: "private",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    // Save metadata
    await ddb.send(
      new PutCommand({
        TableName: "TaskAttachments",
        Item: {
          attachmentId,
          taskId,
          key,
          fileName,
          contentType,
          ownerId: claims.sub,
          createdAt: new Date().toISOString(),
        },
      })
    );

    return res(200, { uploadUrl, attachmentId, key });
  } catch (err) {
    console.error(err);
    return res(500, { error: "Failed to create upload URL" });
  }
};
