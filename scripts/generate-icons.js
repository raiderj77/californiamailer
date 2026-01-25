const sharp = require('sharp');

const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="64" fill="#2563eb"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="200" font-weight="bold" fill="white" text-anchor="middle">CM</text>
</svg>`;

async function generateIcons() {
  const buffer = Buffer.from(svg);
  
  await sharp(buffer)
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png');
  
  await sharp(buffer)
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png');
  
  console.log('Icons generated!');
}

generateIcons();
