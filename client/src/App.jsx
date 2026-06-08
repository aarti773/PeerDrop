import { useEffect, useRef, useState } from "react";
import socket from "./config/socket";
import { createPeerConnection } from "./utils/webrtc";
import { calculateSHA256 } from "./utils/hash";

function App() {
  const [roomId, setRoomId] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("Not connected to any room");
  const [selectedFile, setSelectedFile] = useState(null);
  const [peerStatus, setPeerStatus] = useState("Peer not connected");
  const [message, setMessage] = useState("");
const [receivedFileInfo, setReceivedFileInfo] = useState(null);
const [sendProgress, setSendProgress] = useState(0);
const [receiveProgress, setReceiveProgress] = useState(0);
const [transferStatus, setTransferStatus] = useState("Idle");
const [isSending, setIsSending] = useState(false);
const [senderHash, setSenderHash] = useState("");
const [receiverHash, setReceiverHash] = useState("");
const [hashStatus, setHashStatus] = useState("Not verified");
const [sendSpeed, setSendSpeed] = useState("0 MB/s");
const [receiveSpeed, setReceiveSpeed] = useState("0 MB/s");
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null); 
  const receivedChunksRef = useRef([]);
const receivedFileInfoRef = useRef(null); 
const sendStartTimeRef = useRef(null);
const receiveStartTimeRef = useRef(null);

  const role =
    users.length > 0 && users[0] === socket.id ? "Sender" : "Receiver";

  const setupPeerConnection = (currentRoomId, isSender) => {
    const peerConnection = createPeerConnection();
    peerConnectionRef.current = peerConnection;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          roomId: currentRoomId,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      setPeerStatus(peerConnection.connectionState);
    };

    if (isSender) {
      const dataChannel = peerConnection.createDataChannel("file-transfer");
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        setPeerStatus("Data channel open");
          dataChannel.send("Hello from sender");
      };

      dataChannel.onclose = () => {
        setPeerStatus("Data channel closed");
      };
    } else {
      peerConnection.ondatachannel = (event) => {
        dataChannelRef.current = event.channel;

        dataChannelRef.current.onopen = () => {
          setPeerStatus("Data channel open");
        };

        dataChannelRef.current.onclose = () => {
          setPeerStatus("Data channel closed");
        };
        dataChannelRef.current.onmessage = async (event) => {
  if (event.data instanceof ArrayBuffer) {
    receivedChunksRef.current.push(event.data);
     const receivedBytes = receivedChunksRef.current.reduce(
    (total, chunk) => total + chunk.byteLength,
    0
  );

  if (receivedFileInfoRef.current?.size) {
    setReceiveProgress(
      Math.round((receivedBytes / receivedFileInfoRef.current.size) * 100)
    );
    const elapsedSeconds = (Date.now() - receiveStartTimeRef.current) / 1000;

if (elapsedSeconds > 0) {
  const speedMbps = receivedBytes / (1024 * 1024) / elapsedSeconds;
  setReceiveSpeed(`${speedMbps.toFixed(2)} MB/s`);
}
  }
    return;
  }

  try {
    const data = JSON.parse(event.data);

    if (data.type === "file-meta") {
      receivedChunksRef.current = [];
      receivedFileInfoRef.current = data;
      setReceivedFileInfo(data);
      setReceiveProgress(0);
      setReceiveSpeed("0 MB/s");
receiveStartTimeRef.current = Date.now();
      setTransferStatus("Receiving...");
      return;
    }

    if (data.type === "file-complete") {
      const fileBlob = new Blob(receivedChunksRef.current, {
        type: receivedFileInfoRef.current?.mimeType || "application/octet-stream",
      });
const calculatedHash = await calculateSHA256(fileBlob);
setReceiverHash(calculatedHash);

if (calculatedHash === receivedFileInfoRef.current?.hash) {
  setHashStatus("Verified");
} else {
  setHashStatus("Hash mismatch");
  alert("File verification failed. The received file may be corrupted.");
  return;
}
      const downloadUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = receivedFileInfoRef.current?.name || "received-file";
      link.click();
setTransferStatus("Transfer Complete");
      URL.revokeObjectURL(downloadUrl);
      return;
    }
  } catch {
    setMessage(event.data);
  }
};
      };
    }

    return peerConnection;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get("room");

    if (roomFromUrl) {
      const formattedRoomId = roomFromUrl.toUpperCase();
      setRoomId(formattedRoomId);
      setJoinInput(formattedRoomId);
      socket.emit("join-room", formattedRoomId);
    }
  }, []);

  useEffect(() => {
    socket.on("room-joined", ({ roomId, users }) => {
      setStatus(`Joined room ${roomId}`);
      setUsers(users);
    });

    socket.on("user-joined", async ({ users }) => {
      setStatus("Receiver joined room");
      setUsers(users);

      const isSender = users[0] === socket.id;

      if (isSender && users.length === 2) {
  if (peerConnectionRef.current) {
    console.log("Peer connection already exists, skipping duplicate offer");
    return;
  }

  const peerConnection = setupPeerConnection(roomId, true);
       
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          roomId,
          offer,
        });
      }
    });

    socket.on("webrtc-offer", async ({ offer }) => {
      const peerConnection = setupPeerConnection(roomId, false);

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("webrtc-answer", {
        roomId,
        answer,
      });
    });

    socket.on("webrtc-answer", async ({ answer }) => {
    
  const peerConnection = peerConnectionRef.current;

  if (!peerConnection) return;

  if (peerConnection.signalingState !== "have-local-offer") {
    console.log("Ignoring duplicate answer. Current state:", peerConnection.signalingState);
    return;
  }

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(answer)
  );
});
    socket.on("ice-candidate", async ({ candidate }) => {
      const peerConnection = peerConnectionRef.current;

      if (!peerConnection || !candidate) return;

      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("user-left", ({ userId, users }) => {
      setStatus(`User left: ${userId}`);
      setUsers(users);
      setPeerStatus("Peer disconnected");
    });

    return () => {
      socket.off("room-joined");
      socket.off("user-joined");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("ice-candidate");
      socket.off("user-left");
    };
  }, [roomId]);

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(newRoomId);
    setJoinInput(newRoomId);
    socket.emit("join-room", newRoomId);
  };

  const joinRoom = () => {
    if (!joinInput.trim()) return;

    const formattedRoomId = joinInput.trim().toUpperCase();
    setRoomId(formattedRoomId);
    socket.emit("join-room", formattedRoomId);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const maxFileSize = 50 * 1024 * 1024;

  if (file.size > maxFileSize) {
    alert("File size must be less than 50MB.");
    event.target.value = "";
    setSelectedFile(null);
    return;
  }


    setSelectedFile(file);
    if (dataChannelRef.current?.readyState === "open") {
  dataChannelRef.current.send(
    JSON.stringify({
      type: "file-meta",
      name: file.name,
      size: file.size,
      mimeType: file.type || "Unknown",
    })
  );
}
  };
const handleDrop = (event) => {
  event.preventDefault();

  const file = event.dataTransfer.files[0];
  if (!file) return;

  const maxFileSize = 50 * 1024 * 1024;

  if (file.size > maxFileSize) {
    alert("File size must be less than 50MB.");
    return;
  }

  setSelectedFile(file);
};

const handleDragOver = (event) => {
  event.preventDefault();
};
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };
  const sendFile = async () => {
  if (!selectedFile) return;

  if (dataChannelRef.current?.readyState !== "open") {
    alert("Data channel is not open yet.");
    return;
  }
setSendProgress(0);
setSendSpeed("0 MB/s");
sendStartTimeRef.current = Date.now();
setTransferStatus("Sending...");
setIsSending(true);
const fileHash = await calculateSHA256(selectedFile);
setSenderHash(fileHash);
setHashStatus("Hash calculated");
dataChannelRef.current.send(
  JSON.stringify({
    type: "file-meta",
    name: selectedFile.name,
    size: selectedFile.size,
    mimeType: selectedFile.type || "Unknown",
    hash: fileHash,
  })
);

  const chunkSize = 16 * 1024;
  let offset = 0;

  while (offset < selectedFile.size) {
    const chunk = selectedFile.slice(offset, offset + chunkSize);
    const arrayBuffer = await chunk.arrayBuffer();

    dataChannelRef.current.send(arrayBuffer);

    offset += chunkSize;
    setSendProgress(
  Math.min(100, Math.round((offset / selectedFile.size) * 100))
);
const elapsedSeconds = (Date.now() - sendStartTimeRef.current) / 1000;

if (elapsedSeconds > 0) {
  const speedMbps = offset / (1024 * 1024) / elapsedSeconds;
  setSendSpeed(`${speedMbps.toFixed(2)} MB/s`);
}
  }

  dataChannelRef.current.send(
    JSON.stringify({
      type: "file-complete",
    })
  );
  setTransferStatus("Transfer Complete");
  setIsSending(false);
};

  const shareLink = roomId ? `${window.location.origin}?room=${roomId}` : "";

  return (
    <div style={{ padding: "2rem" }}>
      <h1>PeerDrop</h1>

      <button onClick={createRoom}>Create Room</button>

      {roomId && (
        <div>
          <p>Room ID: {roomId}</p>
          <p>Share Link: {shareLink}</p>
          <p>Status: {status}</p>
          <p>Users in room: {users.length}</p>
          <p>Your role: {role}</p>
          <p>Peer status: {peerStatus}</p>
          <p>Transfer Status: {transferStatus}</p>
          <p>Hash Status: {hashStatus}</p>
          <p>Message: {message}</p>
        </div>
      )}

      <br />

      <input
        placeholder="Enter Room ID"
        value={joinInput}
        onChange={(e) => setJoinInput(e.target.value)}
      />

      <button onClick={joinRoom}>Join Room</button>

      {roomId && role === "Sender" && (
        <div style={{ marginTop: "2rem" }}>
          <h3>Select File</h3>
          <div
  onDrop={handleDrop}
  onDragOver={handleDragOver}
  style={{
    border: "2px dashed gray",
    padding: "20px",
    marginBottom: "10px",
    textAlign: "center",
  }}
>
  <p>Drag & Drop File Here</p>
  <input type="file" onChange={handleFileChange} />
</div>

          {selectedFile && (
            <div>
              <p>File: {selectedFile.name}</p>
              <p>Size: {formatFileSize(selectedFile.size)}</p>
              <p>Type: {selectedFile.type || "Unknown"}</p>
             <button onClick={sendFile} disabled={isSending}>
  {isSending ? "Sending..." : "Send File"}
</button>
               <p>Send Progress: {sendProgress}%</p>
               <p>Send Speed: {sendSpeed}</p>
            </div>
          )}
        </div>
      )}

      {roomId && role === "Receiver" && (
        <div style={{ marginTop: "2rem" }}>
          <h3>Waiting for sender to choose a file...</h3>
          {receivedFileInfo && (
  <div>
    <p>Incoming file: {receivedFileInfo.name}</p>
    <p>Size: {formatFileSize(receivedFileInfo.size)}</p>
    <p>Type: {receivedFileInfo.mimeType}</p>
     <p>Receive Progress: {receiveProgress}%</p>
    <p>Receive Speed: {receiveSpeed}</p>
  </div>
)}
        </div>
      )}
    </div>
  );
}

export default App;