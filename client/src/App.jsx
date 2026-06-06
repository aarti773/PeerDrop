import { useEffect, useState } from "react";

function App() {
  const [roomId, setRoomId] = useState("");
  const [joinInput, setJoinInput] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get("room");

    if (roomFromUrl) {
      setRoomId(roomFromUrl.toUpperCase());
      setJoinInput(roomFromUrl.toUpperCase());
    }
  }, []);

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(newRoomId);
    setJoinInput(newRoomId);
  };

  const joinRoom = () => {
    if (!joinInput.trim()) return;
    setRoomId(joinInput.trim().toUpperCase());
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