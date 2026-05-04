import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Servicio híbrido: Intenta Cloudinary primero, fallback a almacenamiento local
 * Útil para desarrollo sin internet o cuando Cloudinary no responde
 */
@Injectable()
export class CloudinaryService {
  private useLocalFallback: boolean;
  private localUploadPath: string;

  constructor(private configService: ConfigService) {
    this.useLocalFallback =
      this.configService.get('CLOUDINARY_FALLBACK_LOCAL') === 'true';
    this.localUploadPath =
      this.configService.get('LOCAL_UPLOAD_PATH') || './uploads';

    // Configurar Cloudinary
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });

    // Crear carpeta de uploads si no existe
    if (!fs.existsSync(this.localUploadPath)) {
      fs.mkdirSync(this.localUploadPath, { recursive: true });
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    folder = 'products',
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Si está configurado modo fallback, usar almacenamiento local
    if (this.useLocalFallback) {
      return this.uploadLocal(file, folder);
    }

    // Intentar Cloudinary
    try {
      return await this.uploadCloudinary(file, folder);
    } catch (error) {
      // Si falla por conexión, usar fallback local automáticamente
      if (error.message?.includes('Cloudinary') || error.code === 'ENOTFOUND') {
        console.warn(
          '⚠️ Cloudinary no disponible, usando almacenamiento local',
        );
        return this.uploadLocal(file, folder);
      }
      throw error;
    }
  }

  private uploadCloudinary(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) {
            reject(
              new BadRequestException('Error uploading image to Cloudinary'),
            );
          } else if (result) {
            resolve(result.secure_url);
          } else {
            reject(new BadRequestException('No result from Cloudinary'));
          }
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  private uploadLocal(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const ext = path.extname(file.originalname) || '.jpg';
        const filename = `${uuidv4()}${ext}`;
        const folderPath = path.join(this.localUploadPath, folder);

        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }

        const filePath = path.join(folderPath, filename);
        fs.writeFileSync(filePath, file.buffer);

        // Retornar URL relativa
        resolve(`/uploads/${folder}/${filename}`);
      } catch (error) {
        reject(new BadRequestException('Error saving image locally'));
      }
    });
  }

  async deleteImage(imageUrl: string): Promise<void> {
    if (imageUrl.includes('/uploads/')) {
      // Es una imagen local
      const relativePath = imageUrl.replace('/uploads/', '');
      const filePath = path.join(this.localUploadPath, relativePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } else {
      // Es una imagen de Cloudinary
      const publicId = this.extractPublicId(imageUrl);
      await cloudinary.uploader.destroy(publicId);
    }
  }

  extractPublicId(imageUrl: string): string {
    const parts = imageUrl.split('/');
    const lastPart = parts[parts.length - 1];
    const publicId = lastPart.split('.')[0];
    return `${parts[parts.length - 2]}/${publicId}`;
  }
}
