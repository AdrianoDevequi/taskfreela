import { NextResponse } from "next/server";
import * as ftp from "basic-ftp";
import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Convert the incoming file into a buffer
        const arrayBuffer = await file.arrayBuffer();
        let buffer: Buffer = Buffer.from(arrayBuffer as ArrayBuffer);

        // Process image if it's an image file
        let isImage = file.type.startsWith("image/");
        let finalExtension = file.name.substring(file.name.lastIndexOf("."));
        
        if (isImage) {
            // Compress and convert to WebP
            buffer = await sharp(buffer)
                .resize(1920, 1920, { fit: "inside", withoutEnlargement: true }) // Max 1920px dimensions
                .webp({ quality: 80 }) // 80% quality is a good balance between size and visual fidelity
                .toBuffer();
            
            finalExtension = ".webp";
        }

        // Create a unique filename
        const uniqueFilename = `${uuidv4()}${finalExtension}`;

        const client = new ftp.Client();

        try {
            await client.access({
                host: process.env.FTP_HOST,
                user: process.env.FTP_USER,
                password: process.env.FTP_PASSWORD,
                secure: process.env.FTP_SECURE === "true" || process.env.FTP_SECURE === "1",
            });

            // Navigate to the target folder
            const remoteDir = process.env.FTP_REMOTE_DIR || "/img-taskfreela";
            await client.ensureDir(remoteDir);

            // Upload the file via stream
            const readableStream = Readable.from(buffer);
            await client.uploadFrom(readableStream, uniqueFilename);
            
        } catch (ftpError) {
            console.error("FTP Upload Error:", ftpError);
            throw new Error("Failed to upload to FTP server");
        } finally {
            client.close();
        }

        const publicUrl = `${process.env.FTP_PUBLIC_URL}/${uniqueFilename}`;

        return NextResponse.json({ 
            success: true, 
            url: publicUrl,
            filename: uniqueFilename 
        });

    } catch (error) {
        console.error("POST /api/upload Error:", error);
        return NextResponse.json({ error: "Failed to upload file." }, { status: 500 });
    }
}
