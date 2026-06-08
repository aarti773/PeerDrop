# PeerDrop

PeerDrop is a decentralized peer-to-peer file sharing application built using React, WebRTC, Socket.io, and Node.js.

Files are transferred directly between browsers without being stored on any central server, ensuring privacy and low-latency transfers.

## Features

* Direct browser-to-browser file transfer using WebRTC
* Room creation with shareable invite links
* Real-time signaling using Socket.io
* SHA-256 file integrity verification
* Transfer progress tracking
* Transfer speed monitoring
* Drag-and-drop file upload
* Automatic file download on receiver side
* Connection status monitoring
* 50 MB file size validation
* Graceful disconnect handling

## Tech Stack

### Frontend

* React
* Vite
* Socket.io Client

### Backend

* Node.js
* Express
* Socket.io

### Communication

* WebRTC Data Channels
* STUN Servers

## Project Architecture

Sender Browser
↓
Socket.io Signaling Server
↓
Receiver Browser

After signaling is completed, files are transferred directly through a WebRTC Data Channel.

## Local Setup

### Clone Repository

```bash
git clone https://github.com/aarti773/PeerDrop.git
cd PeerDrop
```

### Backend Setup

```bash
cd server
npm install
npm start
```

### Frontend Setup

```bash
cd client
npm install
npm run dev
```

## Environment Variables

### Client

```env
VITE_SERVER_URL=http://localhost:5000
```

### Server

```env
PORT=5000
CLIENT_URL=http://localhost:5173
```

## Deployment

Frontend:

* Vercel

Backend:

* Railway

## Live Demo

Frontend:
https://peer-drop-two.vercel.app

Backend:
https://peerdrop-production-4a15.up.railway.app

## Future Improvements

* Multi-peer file sharing
* End-to-end encryption
* Large file support
* Transfer resume functionality
* TURN server support

## Author

Aarti
Mechanical,IIT Roorkee