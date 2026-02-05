const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { res } = require("../utils/response");

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const BUCKET = "taskboard-attachments-yourname"; // update

module.exports.getDownloadUrl = async (event) => {
  try {
    const claims = event.requestContext.authorizer.jwt.claims;
    const attachmentId = event.queryStringParameters?.attachmentId;

    if (!attachmentId) return res(400, { error: "attachmentId is required" });

    // Fetch attachment metadata
    const { Item } = await ddb.send(
      new GetCommand({
        TableName: "TaskAttachments",
        Key: { attachmentId },
      })
    );

    if (!Item) return res(404, { error: "Attachment not found" });

    // Prevent cross-user access
    if (Item.ownerId !== claims.sub)
      return res(403, { error: "Access denied" });

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: Item.key,
    });

    const downloadUrl = await getSignedUrl(s3, command, {
      expiresIn: 900,
    });

    return res(200, { downloadUrl });
  } catch (err) {
    console.error(err);
    return res(500, { error: "Failed to create download URL" });
  }
};
