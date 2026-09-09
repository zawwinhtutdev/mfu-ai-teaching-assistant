import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import crypto from "crypto"

interface SpacesConfig {
  bucket: string
  region: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  publicBucket: boolean
  cdnBaseUrl?: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

function getSpacesConfig(): SpacesConfig {
  const bucket = requireEnv("DO_SPACES_BUCKET")
  const region = requireEnv("DO_SPACES_REGION")

  return {
    bucket,
    region,
    endpoint: `https://${region}.digitaloceanspaces.com`,
    accessKeyId: requireEnv("DO_SPACES_KEY"),
    secretAccessKey: requireEnv("DO_SPACES_SECRET"),
    publicBucket: process.env.DO_SPACES_PUBLIC === "true",
    cdnBaseUrl: process.env.DO_SPACES_CDN_URL ? trimTrailingSlash(process.env.DO_SPACES_CDN_URL) : undefined,
  }
}

let cachedClient: S3Client | null = null

function getSpacesClient(): S3Client {
  if (cachedClient) return cachedClient

  const config = getSpacesConfig()
  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return cachedClient
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
}

function sanitizeFolderPart(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/@/g, "-at-")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function buildReadableUserFolder(userId: string, userEmail?: string, userLabel?: string): string {
  const base = userLabel || "user"
  const sanitized = sanitizeFolderPart(base).slice(0, 24) || "user"
  const digest = crypto
    .createHash("sha256")
    .update(`${userId}:${userEmail || ""}`)
    .digest("hex")
    .slice(0, 16)
  return `${sanitized}-${digest}`
}

export function buildUserDocumentObjectKey(input: {
  userId: string
  fileName: string
  userEmail?: string
  userLabel?: string
}): string {
  const safeName = sanitizeFileName(input.fileName) || "file"
  const random = crypto.randomBytes(6).toString("hex")
  const userFolder = buildReadableUserFolder(input.userId, input.userEmail, input.userLabel)
  return `${userFolder}/documents/${Date.now()}-${random}-${safeName}`
}

export async function uploadUserDocumentToSpaces(input: {
  userId: string
  userEmail?: string
  userLabel?: string
  fileName: string
  buffer: Buffer
  contentType?: string
}) {
  const config = getSpacesConfig()
  const client = getSpacesClient()
  const objectKey = buildUserDocumentObjectKey({
    userId: input.userId,
    fileName: input.fileName,
    userEmail: input.userEmail,
    userLabel: input.userLabel,
  })

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: input.buffer,
      ContentType: input.contentType || "application/octet-stream",
    }),
  )

  return {
    objectKey,
    bucket: config.bucket,
    region: config.region,
  }
}

export async function deleteObjectFromSpaces(objectKey: string) {
  const config = getSpacesConfig()
  const client = getSpacesClient()

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
  )
}

function buildPublicUrl(config: SpacesConfig, objectKey: string): string {
  if (config.cdnBaseUrl) {
    return `${config.cdnBaseUrl}/${objectKey}`
  }
  return `https://${config.bucket}.${config.region}.digitaloceanspaces.com/${objectKey}`
}

export async function getDocumentReadUrl(objectKey: string, expiresInSeconds = 300) {
  const config = getSpacesConfig()

  if (config.publicBucket) {
    return buildPublicUrl(config, objectKey)
  }

  const client = getSpacesClient()
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
    { expiresIn: expiresInSeconds },
  )
}
