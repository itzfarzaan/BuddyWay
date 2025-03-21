// Initialize socket connection
let userName = '';

// Add connection debugging
socket.on('connect', () => {
  console.log('Socket connected with ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

// DOM Elements
const createSessionBtn = document.getElementById('createSessionBtn');
const joinSessionBtn = document.getElementById('joinSessionBtn');
const sessionCodeInput = document.getElementById('sessionCode');
const nameModal = document.getElementById('nameModal');
const userNameInput = document.getElementById('userName');
const continueBtn = document.getElementById('continueBtn');

// Show name modal
function showNameModal(action, sessionCode = null) {
  nameModal.classList.add('active');
  
  continueBtn.onclick = () => {
    userName = userNameInput.value.trim();
    
    if (userName) {
      nameModal.classList.remove('active');
      
      if (action === 'create') {
        createNewSession();
      } else if (action === 'join') {
        joinExistingSession(sessionCode);
      }
    } else {
      // Show error if name is empty
      let errorMsg = document.querySelector('.error-message');
      if (!errorMsg) {
        errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        userNameInput.parentNode.insertBefore(errorMsg, userNameInput.nextSibling);
      }
      errorMsg.textContent = 'Please enter your name to continue';
    }
  };
  
  // Allow pressing Enter to continue
  userNameInput.onkeyup = (e) => {
    if (e.key === 'Enter') {
      continueBtn.click();
    }
  };
}

// Create a new session
function createNewSession() {
  // Generate a random 6-digit code
  const sessionCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Emit create session event
  socket.emit('create-session', {
    sessionCode,
    hostId: socket.id,
    userName
  });
  
  // Save session info to localStorage
  localStorage.setItem('buddyway_session', JSON.stringify({
    sessionCode,
    userName,
    isHost: true
  }));
  
  // Redirect to map page
  window.location.href = `/map?session=${sessionCode}`;
}

// Join an existing session
function joinExistingSession(sessionCode) {
  // Show loading indicator or message
  const joinBtn = document.getElementById('joinSessionBtn');
  const originalText = joinBtn.textContent;
  joinBtn.textContent = 'Joining...';
  joinBtn.disabled = true;
  
  console.log(`Attempting to join session: ${sessionCode} with user: ${userName}`);
  
  // Emit join session event
  socket.emit('join-session', {
    sessionCode,
    userId: socket.id,
    userName
  });
  
  // Listen for session join response with timeout
  let responseReceived = false;
  const timeout = setTimeout(() => {
    if (!responseReceived) {
      console.error('Join session response timeout');
      alert('Failed to join session. Please try again.');
      joinBtn.textContent = originalText;
      joinBtn.disabled = false;
    }
  }, 5000);
  
  socket.once('session-join-response', (response) => {
    responseReceived = true;
    clearTimeout(timeout);
    
    console.log('Received join response:', response);
    
    if (response.success) {
      // Save session info to localStorage
      localStorage.setItem('buddyway_session', JSON.stringify({
        sessionCode,
        userName,
        isHost: false
      }));
      
      // Redirect to map page
      window.location.href = `/map?session=${sessionCode}`;
    } else {
      // Show error message
      alert(response.message || 'Failed to join session. Please check the code and try again.');
      joinBtn.textContent = originalText;
      joinBtn.disabled = false;
    }
  });
}

// Event Listeners
createSessionBtn.addEventListener('click', () => {
  showNameModal('create');
});

joinSessionBtn.addEventListener('click', () => {
  const sessionCode = sessionCodeInput.value.trim();
  
  if (sessionCode.length === 6 && /^\d+$/.test(sessionCode)) {
    showNameModal('join', sessionCode);
  } else {
    alert('Please enter a valid 6-digit session code');
  }
});

// Allow pressing Enter to join session
sessionCodeInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    joinSessionBtn.click();
  }
});

// Check if user was previously in a session
window.addEventListener('load', () => {
  const savedSession = localStorage.getItem('buddyway_session');
  
  if (savedSession) {
    const sessionData = JSON.parse(savedSession);
    
    // Ask if user wants to rejoin their previous session
    const rejoin = confirm(`Do you want to rejoin your previous session (${sessionData.sessionCode})?`);
    
    if (rejoin) {
      userName = sessionData.userName;
      
      if (sessionData.isHost) {
        // Emit create session event (rejoin as host)
        socket.emit('create-session', {
          sessionCode: sessionData.sessionCode,
          hostId: socket.id,
          userName
        });
      } else {
        // Emit join session event
        socket.emit('join-session', {
          sessionCode: sessionData.sessionCode,
          userId: socket.id,
          userName
        });
        
        // Listen for session join response
        socket.once('session-join-response', (response) => {
          if (!response.success) {
            // Session no longer exists, clear localStorage
            localStorage.removeItem('buddyway_session');
            alert('Your previous session is no longer available.');
            return;
          }
        });
      }
      
      // Redirect to map page
      window.location.href = `/map?session=${sessionData.sessionCode}`;
    } else {
      // Clear previous session data
      localStorage.removeItem('buddyway_session');
    }
  }
});
