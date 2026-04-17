// INSIDE MessageThreadView.jsx

import {
  getThreadMessages,
  sendMessage,
  markThreadAsRead,
  getThreadReadState
} from "../../services/messages";

// ADD STATE
const [readState, setReadState] = useState(null);

// LOAD READ STATE
useEffect(() => {
  if (!threadId) return;

  getThreadReadState(threadId)
    .then(setReadState)
    .catch(console.error);
}, [threadId]);

// RENDER STATUS (inside message map)
const isMine = msg.sender_user_id === readState?.currentUserId;

let status = "";
if (isMine) {
  if (!readState?.lastReadByOthersAt) {
    status = "Gesendet";
  } else if (readState.lastReadByOthersAt >= msg.created_at) {
    status = "Gelesen";
  } else {
    status = "Gesendet";
  }
}

// JSX:
{isMine && (
  <div style={{ fontSize: "10px", opacity: 0.7 }}>
    {status}
  </div>
)}
