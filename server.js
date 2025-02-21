
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const TwitterLite = require('twitter-lite');

const twitterClient = new TwitterLite({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
});

const allowedFormats = ['image/jpeg', 'image/png', 'image/gif'];

const PREDEFINED_SIZES = [
  { width: 300, height: 250 },
  { width: 728, height: 90 },
  { width: 160, height: 600 },
  { width: 300, height: 600 },
];

const HTML_FORM = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Simple Image Resizer</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2em; }
    form { margin-bottom: 2em; }
    .upload-section { margin-bottom: 1em; }
    button { padding: 0.5em 1em; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Upload and Resize Image</h1>
  <form action="/upload" method="POST" enctype="multipart/form-data">
    <div class="upload-section">
      <label for="image">Choose an image to upload:</label><br />
      <input type="file" name="image" id="image" accept="image/*" required />
    </div>
    <button type="submit">Upload & Resize</button>
  </form>
</body>
</html>
`;


app.get('/', (req, res) => {
  res.send(HTML_FORM);
});

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    if (!allowedFormats.includes(req.file.mimetype)) {
      return res.status(400).send('Unsupported file format.');
    }

    const originalBuffer = req.file.buffer;

    const resizedBuffers = [];
    for (const size of PREDEFINED_SIZES) {
      const resizedImageBuffer = await sharp(originalBuffer)
        .resize(size.width, size.height, { fit: 'cover' })
        .toBuffer();
      resizedBuffers.push({ buffer: resizedImageBuffer, width: size.width, height: size.height });
    }

    const mediaIds = [];

    for (const item of resizedBuffers) {
      const base64Content = item.buffer.toString('base64');

      try {
        const mediaUploadResponse = await twitterClient.post('media/upload', {
          media_data: base64Content,
        });
        const mediaId = mediaUploadResponse.media_id_string;
        mediaIds.push(mediaId);
      } catch (error) {
        console.error('Media upload error:', error);
      }
    }

    if (mediaIds.length > 0) {
     
      try {
        await twitterClient.post('statuses/update', {
          status: 'Automatically resized images!',
          media_ids: mediaIds.join(','),
        });
        console.log('Images posted successfully!');
      } catch (error) {
        console.error('Error posting images:', error);
      }
    }
    res.status(200).send(`
      <h2>Success!</h2>
      <p>Your image was resized and posted to your X/Twitter account (check logs for details).</p>
      <a href="/">Go Back</a>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send('An internal error occurred.');
  }
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
