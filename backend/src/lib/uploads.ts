// Multer configuration shared by the file-upload routes.
// destination is resolved relative to process.cwd() (the backend/ package root).

import multer from 'multer';
import path from 'path';

const multerStorage = multer.diskStorage({
  destination: './storage/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// General structure uploads.
export const upload = multer({ storage: multerStorage });

// Dedicated instance for variant .pdb uploads: restricts to .pdb (case-insensitive)
// and caps size to guard ./storage/.
export const pdbUpload = multer({
  storage: multerStorage,
  limits: { fileSize: 30 * 1024 * 1024 }, // ~30 MB
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.pdb') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});
