import { useEffect, useRef, useState } from "react";
import socket from "./config/socket";
import { createPeerConnection } from "./utils/webrtc";

function App() {
  const [roomId, setRoomId] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("Not connected to any room");
  const [selectedFile, setSelectedFile] = useState(null);
  const [peerStatus, setPeerStatus] = useState("Peer not connected");
  const [message, setMessage] = useState("");
const [receivedFileInfo, setReceivedFileInfo] = useState(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null); 
  const receivedChunksRef = useRef([]);
const receivedFileInfoRef = useRef(null); 

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
        dataChannelRef.current.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    receivedChunksRef.current.push(event.data);
    return;
  }

  try {
    const data = JSON.parse(event.data);

    if (data.type === "file-meta") {
      receivedChunksRef.current = [];
      receivedFileInfoRef.current = data;
      setReceivedFileInfo(data);
      return;
    }

    if (data.type === "file-complete") {
      const fileBlob = new Blob(receivedChunksRef.current, {
        type: receivedFileInfoRef.current?.mimeType || "application/octet-stream",
      });

      const downloadUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = receivedFileInfoRef.current?.name || "received-file";
      link.click();

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

  const chunkSize = 16 * 1024;
  let offset = 0;

  while (offset < selectedFile.size) {
    const chunk = selectedFile.slice(offset, offset + chunkSize);
    const arrayBuffer = await chunk.arrayBuffer();

    dataChannelRef.current.send(arrayBuffer);

    offset += chunkSize;
  }

  dataChannelRef.current.send(
    JSON.stringify({
      type: "file-complete",
    })
  );
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
          <input type="file" onChange={handleFileChange} />

          {selectedFile && (
            <div>
              <p>File: {selectedFile.name}</p>
              <p>Size: {formatFileSize(selectedFile.size)}</p>
              <p>Type: {selectedFile.type || "Unknown"}</p>
               <button onClick={sendFile}>Send File</button>
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
  </div>
)}
        </div>
      )}
    </div>
  );
}

export default App;