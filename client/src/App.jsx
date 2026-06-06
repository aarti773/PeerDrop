import { useEffect, useState } from "react";
import socket from "./config/socket";

function App() {
  const [roomId, setRoomId] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("Not connected to any room");

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

    socket.on("user-joined", ({ userId, users }) => {
      setStatus(`User joined: ${userId}`);
      setUsers(users);
    });

    socket.on("user-left", ({ userId, users }) => {
      setStatus(`User left: ${userId}`);
      setUsers(users);
    });

    return () => {
      socket.off("room-joined");
      socket.off("user-joined");
      socket.off("user-left");
    };
  }, []);

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
        </div>
      )}

      <br />

      <input
        placeholder="Enter Room ID"
        value={joinInput}
        onChange={(e) => setJoinInput(e.target.value)}
      />

      <button onClick={joinRoom}>Join Room</button>
    </div>
  );
}

export default App;