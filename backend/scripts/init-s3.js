"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_s3_1 = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const path_1 = require("path");
dotenv.config({ path: (0, path_1.resolve)(__dirname, '..', '.env') });
const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.AWS_S3_BUCKET || '';
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || '';
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
if (!BUCKET || !ACCESS_KEY || !SECRET_KEY) {
    console.error('❌ Missing AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY in .env');
    process.exit(1);
}
const s3 = new client_s3_1.S3Client({
    region: REGION,
    credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
    },
});
const FOLDERS = ['classes/', 'recordings/', 'avatars/', 'general/'];
async function bucketExists() {
    try {
        await s3.send(new client_s3_1.HeadBucketCommand({ Bucket: BUCKET }));
        return true;
    }
    catch {
        return false;
    }
}
async function createBucket() {
    console.log(`\n🪣  Creating bucket: ${BUCKET} in ${REGION}...`);
    const params = { Bucket: BUCKET };
    if (REGION !== 'us-east-1') {
        params.CreateBucketConfiguration = { LocationConstraint: REGION };
    }
    await s3.send(new client_s3_1.CreateBucketCommand(params));
    console.log('   ✅ Bucket created.');
}
async function disableBlockPublicAccess() {
    console.log('🔓 Removing S3 Block Public Access settings...');
    await s3.send(new client_s3_1.DeletePublicAccessBlockCommand({ Bucket: BUCKET }));
    console.log('   ✅ Public access block removed.');
}
async function setBucketPolicy() {
    console.log('📜 Setting bucket policy for public read...');
    const policy = {
        Version: '2012-10-17',
        Statement: [
            {
                Sid: 'PublicReadGetObject',
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: `arn:aws:s3:::${BUCKET}/*`,
            },
        ],
    };
    await s3.send(new client_s3_1.PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify(policy),
    }));
    console.log('   ✅ Bucket policy applied (public-read for objects).');
}
async function createFolderPlaceholders() {
    console.log('📁 Creating folder placeholders...');
    for (const folder of FOLDERS) {
        await s3.send(new client_s3_1.PutObjectCommand({
            Bucket: BUCKET,
            Key: folder,
            Body: '',
            ContentType: 'application/x-directory',
        }));
        console.log(`   ✅ ${folder}`);
    }
}
async function main() {
    console.log('=== S3 Bucket Initialization ===');
    console.log(`   Bucket : ${BUCKET}`);
    console.log(`   Region : ${REGION}`);
    const exists = await bucketExists();
    if (exists) {
        console.log('\n🪣  Bucket already exists — skipping creation.');
    }
    else {
        await createBucket();
    }
    await disableBlockPublicAccess();
    await setBucketPolicy();
    await createFolderPlaceholders();
    console.log('\n🎉 S3 initialization complete!');
    console.log(`   Upload URL pattern: https://${BUCKET}.s3.${REGION}.amazonaws.com/<folder>/<uuid>.<ext>`);
}
main().catch((err) => {
    console.error('❌ S3 initialization failed:', err.message || err);
    process.exit(1);
});
//# sourceMappingURL=init-s3.js.map