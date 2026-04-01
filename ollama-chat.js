import './el.js'
import ChatUI from './chat-ui/chat-ui.js'

const _app = document.getElementById('app');

export default function OllamaChat() {

  // Reset body
  el(document.body).css({
    'margin': '0',
    'padding': '0',
    'font-family': 'Arial, sans-serif',
    'background': '#e5e5e5'
  }).get()

  // Container utama
  const container = el('div').id('container')

  container.css({
    'display': 'flex',
    'width': '100vw',
    'height': '100vh',
    'background': '#f5f5f5'
  })

  // Sidebar
  const sidebar = el('div').id('sidebar')
  sidebar.css({
    'width': '360px',
    'min-width': '360px',
    'height': '100vh',
    'max-height': '100vh',
    'background': '#ffffff',
    'border-right': '1px solid #e0e0e0',
    'display': 'flex',
    'flex-direction': 'column',
    'overflow': 'hidden'
  })

  // Custom scrollbar for sidebar
  const styleEl = el('style')
    .html(`
      #sidebar::-webkit-scrollbar,
      #chat-container::-webkit-scrollbar {
        width: 6px;
      }
      
      #sidebar::-webkit-scrollbar-track,
      #chat-container::-webkit-scrollbar-track {
        background: transparent;
      }
      
      #sidebar::-webkit-scrollbar-thumb,
      #chat-container::-webkit-scrollbar-thumb {
        background: rgba(0,0,0,0.2);
        border-radius: 3px;
      }
      
      #sidebar::-webkit-scrollbar-thumb:hover,
      #chat-container::-webkit-scrollbar-thumb:hover {
        background: rgba(0,0,0,0.3);
      }
      
      #mobile-menu-button {
        display: none;
      }

      #sidebar-overlay {
        display: none;
      }
      #sidebar-overlay.visible {
        display: block;
      }

      @media (max-width: 768px) {
        #mobile-menu-button {
          display: flex;
          position: absolute;
          top: 22px;
          right: 16px;
          z-index: 1002;
          background: #075E54;
          color: white;
          border: none;
          border-radius: 999px;
          padding: 10px 14px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.15);
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
        }

        #sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 80%;
          max-width: 320px;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
          box-shadow: 2px 0 20px rgba(0,0,0,0.16);
          z-index: 1001;
          background: #ffffff;
          display: flex !important;
          visibility: hidden;
        }

        #sidebar.open {
          transform: translateX(0);
          visibility: visible;
        }

        #container {
          flex-direction: column;
        }

        #sidebar-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          z-index: 1000;
        }

        #sidebar-overlay.visible {
          display: block;
        }
      }
    `);

  document.head.appendChild(styleEl.get());

  const sidebarOverlay = el('div')
    .id('sidebar-overlay')
    .click(function() {
      toggleMobileSidebar(false);
    });

  document.body.appendChild(sidebarOverlay.get());

  let dialogConfirmCallback = null;

  const dialogOverlay = el('div')
    .id('dialog-overlay')
    .css({
      'display': 'none',
      'position': 'fixed',
      'inset': '0',
      'background': 'rgba(0,0,0,0.45)',
      'align-items': 'center',
      'justify-content': 'center',
      'z-index': '1004'
    });

  const dialogBox = el('div')
    .css({
      'width': '92%',
      'max-width': '380px',
      'background': 'white',
      'border-radius': '18px',
      'padding': '24px',
      'box-shadow': '0 20px 50px rgba(0,0,0,0.18)',
      'text-align': 'left'
    });

  const dialogTitle = el('h3')
    .text('Confirm')
    .css({
      'margin': '0 0 12px 0',
      'font-size': '18px',
      'color': '#111'
    });

  const dialogMessage = el('p')
    .text('Are you sure?')
    .css({
      'margin': '0',
      'color': '#444',
      'line-height': '1.6'
    });

  const dialogActions = el('div')
    .css({
      'margin-top': '22px',
      'display': 'flex',
      'justify-content': 'flex-end',
      'gap': '10px'
    });

  const cancelDialogBtn = el('button')
    .text('Cancel')
    .css({
      'padding': '10px 14px',
      'border': '1px solid #ccc',
      'background': 'white',
      'color': '#333',
      'border-radius': '10px',
      'cursor': 'pointer'
    })
    .click(function() {
      hideDialog();
    });

  const confirmDialogBtn = el('button')
    .text('Delete')
    .css({
      'padding': '10px 14px',
      'border': 'none',
      'background': '#ff4444',
      'color': 'white',
      'border-radius': '10px',
      'cursor': 'pointer'
    })
    .click(async function() {
      const callback = dialogConfirmCallback;
      hideDialog();
      if (callback) {
        await callback();
      }
    });

  dialogActions.child([cancelDialogBtn, confirmDialogBtn]);
  dialogBox.child([dialogTitle, dialogMessage, dialogActions]);
  dialogOverlay.child(dialogBox);
  document.body.appendChild(dialogOverlay.get());

  dialogOverlay.el.addEventListener('click', function(event) {
    if (event.target === dialogOverlay.el) {
      hideDialog();
    }
  });

  const toastContainer = el('div')
    .id('toast-container')
    .css({
      'position': 'fixed',
      'bottom': '22px',
      'right': '22px',
      'display': 'flex',
      'flex-direction': 'column',
      'gap': '10px',
      'z-index': '1005',
      'pointer-events': 'none'
    });

  document.body.appendChild(toastContainer.get());

  function showToast(message, type = 'info') {
    const toast = el('div')
      .text(message)
      .css({
        'padding': '12px 16px',
        'border-radius': '12px',
        'color': 'white',
        'font-size': '14px',
        'background': type === 'success' ? '#00A884' : type === 'error' ? '#ff4444' : '#333',
        'box-shadow': '0 12px 30px rgba(0,0,0,0.18)',
        'opacity': '0',
        'transition': 'opacity 0.2s ease'
      });

    toastContainer.el.appendChild(toast.get());
    setTimeout(() => {
      toast.el.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      toast.el.style.opacity = '0';
      setTimeout(() => {
        if (toast.el.parentNode) {
          toast.el.parentNode.removeChild(toast.el);
        }
      }, 200);
    }, 2600);
  }

  function showDialog(title, message, onConfirm) {
    dialogTitle.text(title);
    dialogMessage.text(message);
    dialogConfirmCallback = onConfirm;
    dialogOverlay.el.style.display = 'flex';
  }

  function hideDialog() {
    dialogOverlay.el.style.display = 'none';
    dialogConfirmCallback = null;
  }

  function toggleMobileSidebar(show) {
    if (show) {
      sidebar.el.classList.add('open');
      sidebarOverlay.el.classList.add('visible');
    } else {
      sidebar.el.classList.remove('open');
      sidebarOverlay.el.classList.remove('visible');
    }
  }

  // Sidebar header
  const sidebarHeader = el('div')
    .css({
      'padding': '20px',
      'background': 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)',
      'color': 'white'
    })

  const sidebarTitle = el('h2')
    .text('Chat History')
    .css({
      'margin': '0',
      'font-size': '20px',
      'font-weight': '600'
    })

  // Model selector container
  const modelSelectorContainer = el('div')
    .css({
      'margin-top': '15px',
      'display': 'flex',
      'flex-direction': 'column',
      'gap': '8px'
    })

  // Refresh button for models
  const refreshBtn = el('button')
    .html('<i class="fas fa-sync-alt"></i>')
    .css({
      'padding': '6px 10px',
      'background': 'rgba(255,255,255,0.3)',
      'color': 'white',
      'border': 'none',
      'border-radius': '4px',
      'cursor': 'pointer',
      'font-size': '12px',
      'align-self': 'flex-end',
      'transition': 'all 0.2s'
    })
    .hover(
      function() { 
        this.style.background = 'rgba(255,255,255,0.4)';
        this.style.transform = 'rotate(90deg)';
      },
      function() { 
        this.style.background = 'rgba(255,255,255,0.3)';
        this.style.transform = 'rotate(0deg)';
      }
    )
    .click(function() {
      console.log('Refreshing model list...');
      modelSelect.el.innerHTML = '';
      modelLoading.show();
      loadModels();
    });

  modelSelectorContainer.child(refreshBtn);

  const modelLabel = el('label')
    .text('AI Model:')
    .css({
      'font-size': '13px',
      'opacity': '0.9'
    })

  const modelSelect = el('select')
    .id('model-select')
    .css({
      'padding': '8px 12px',
      'border-radius': '6px',
      'border': 'none',
      'background': 'rgba(255,255,255,0.9)',
      'color': '#333',
      'font-size': '13px',
      'cursor': 'pointer',
      'outline': 'none',
      'transition': 'all 0.2s',
      'appearance': 'none',
      '-webkit-appearance': 'none',
      '-moz-appearance': 'none',
      'background-image': `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
      'background-repeat': 'no-repeat',
      'background-position': 'right 12px center',
      'padding-right': '36px'
    })
    .hover(
      function() { this.style.background = 'rgba(255,255,255,1)'; },
      function() { this.style.background = 'rgba(255,255,255,0.9)'; }
    )
    .focus(function() {
      this.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.5)';
    })
    .blur(function() {
      this.style.boxShadow = '';
    })
    .change(async function() {
      const selectedModel = this.value;
      console.log('Using model:', selectedModel);
      // Store selected model for use in onChat callback
      window.selectedOllamaModel = selectedModel;
    });

  // Loading indicator for models
  const modelLoading = el('div')
    .text('Loading models...')
    .css({
      'font-size': '12px',
      'opacity': '0.8',
      'font-style': 'italic'
    });

  modelSelectorContainer.child([modelLabel, modelSelect, modelLoading]);

  const newChatBtn = el('button')
    .html('<i class="fas fa-plus"></i> New Chat')
    .css({
      'margin-top': '15px',
      'padding': '10px 16px',
      'background': 'rgba(255,255,255,0.2)',
      'color': 'white',
      'border': 'none',
      'border-radius': '8px',
      'cursor': 'pointer',
      'font-size': '14px',
      'display': 'flex',
      'align-items': 'center',
      'gap': '8px',
      'transition': 'background 0.2s'
    })
    .hover(
      function() { this.style.background = 'rgba(255,255,255,0.3)'; },
      function() { this.style.background = 'rgba(255,255,255,0.2)'; }
    )
    .click(async function() {
      console.log('🆕 Creating new chat session...');
      
      // Generate new session ID
      const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chat_session_id', newSessionId);
      
      // Clear conversation history
      conversationHistory = [];
      conversationSummary = '';
      
      // Reset first message flag for new session
      isFirstMessageInSession = true;
      
      // Reset ChatUI messages
      if (chatInstance && chatInstance.resetMessages) {
        chatInstance.resetMessages();
      }
      
      // Update current session ID reference
      currentSessionId = newSessionId;
      
      // Re-render chat history list to update highlight
      await loadChatHistory();
      
      // Hide mobile sidebar after creating a new chat
      toggleMobileSidebar(false);
      
      console.log('✅ New chat session created:', newSessionId);
    })

  sidebarHeader.child([sidebarTitle, modelSelectorContainer, newChatBtn])

  // Fetch available models from Ollama
  async function loadModels() {
    try {
      console.log('🔄 Fetching models from Ollama...');
      const response = await fetch('/api/ollama/tags');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error:', response.status, errorText);
        
        if (response.status === 502) {
          throw new Error('Cannot connect to Ollama - make sure "ollama serve" is running');
        }
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Received models data:', data);
      
      const models = data.models || [];

      // Clear loading message
      modelLoading.hide();

      if (models.length === 0) {
        console.warn('⚠️ No models found in Ollama');
        const noModelsOptionEl = el('option')
          .text('No models installed')
          .attr('disabled', 'true');
        modelSelect.el.appendChild(noModelsOptionEl.get());
        
        modelLoading
          .text('Install models with: ollama pull llama3.2')
          .css('color', '#ffcc00');
        return;
      }

      // Clear existing options first
      modelSelect.el.innerHTML = '';

      // Populate model options with details
      let defaultModel = null;
      models.forEach((model, index) => {
        // Format: model_name (size)
        const modelName = model.name;
        const sizeInGB = (model.size / (1024 * 1024 * 1024)).toFixed(1);
        
        const displayText = `${modelName} (${sizeInGB} GB)`;
        
        // Create option and append directly to select element
        const optionEl = el('option')
          .text(displayText)
          .attr('value', modelName);
        
        // Append option directly using native DOM
        modelSelect.el.appendChild(optionEl.get());

        // Set first model as default
        if (index === 0) {
          defaultModel = modelName;
        }
      });

      // Select default model
      if (defaultModel) {
        modelSelect.el.value = defaultModel;
        window.selectedOllamaModel = defaultModel;
        console.log('✅ Default model selected:', defaultModel);
      }
      
      console.log(`✅ Loaded ${models.length} models from Ollama`);
      
      // Update loading indicator to show success
      modelLoading
        .html(`<i class="fas fa-check-circle"></i> ${models.length} model(s) loaded`)
        .css('color', '#90EE90');
        
    } catch (error) {
      console.error('❌ Error loading models:', error.message);
      
      modelLoading
        .html('<i class="fas fa-exclamation-triangle"></i> Connection failed')
        .css('color', '#ff6b6b');
      
      // Show error in dropdown
      const errorOptionEl = el('option')
        .text('Cannot connect to Ollama')
        .attr('disabled', 'true');
      modelSelect.el.appendChild(errorOptionEl.get());
      
      // Reset selected model
      window.selectedOllamaModel = null;
    }
  }

  // Load models on initialization
  loadModels();

  // Chat history list container
  const chatList = el('div')
    .id('chat-history-list')
    .css({
      'flex': '1',
      'overflow-y': 'auto',
      'padding': '10px'
    })

  // Use event delegation for better performance and avoid duplicate handlers
  let isLoadingSession = false; // Prevent rapid multiple loads
  
  chatList.el.addEventListener('click', async function(e) {
    const chatItemEl = e.target.closest('[data-session-id]');
    if (!chatItemEl) return;
    
    const sessionId = chatItemEl.dataset.sessionId;
    const sessionTitle = chatItemEl.dataset.sessionTitle;
    
    // Prevent rapid multiple clicks
    if (isLoadingSession) {
      console.log('⏳ Blocking - currently loading session');
      return;
    }
    
    // Check if this is different from current active session
    // Only block if the session is actually in DB and already selected
    const currentActiveSession = localStorage.getItem('chat_session_id');
    console.log('🖱️ Click handler check:');
    console.log('  - Clicked session:', sessionId);
    console.log('  - Current active from localStorage:', currentActiveSession);
    console.log('  - Session in DB?', sessionInDb);
    console.log('  - Match?', sessionId === currentActiveSession);
    console.log('  - Should block?', sessionId === currentActiveSession && sessionInDb);
    
    if (sessionId && sessionId === currentActiveSession && sessionInDb) {
      console.log('⚠️ Session already active (in DB):', sessionId);
      return;
    }
    
    // Proceed with session switch
    console.log('🔄 Switching to session:', sessionTitle);
    
    // Set loading flag
    isLoadingSession = true;
    
    // Update active session ID FIRST before loading
    localStorage.setItem('chat_session_id', sessionId);
    currentSessionId = sessionId;
    
    // Mark session as active in DB since user explicitly selected it
    sessionInDb = true;
    console.log('✅ Session marked as active (user selected):', sessionId);
    
    // Reset first message flag when switching sessions
    isFirstMessageInSession = false;
    
    // Load conversation history for this session
    try {
      const response = await fetch(`/api/conversations?session_id=${sessionId}`);
      const data = await response.json();
      
      if (data.success && data.history && data.history.length > 0) {
        // Update conversation history
        conversationHistory = data.history.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        console.log('✅ Loaded', conversationHistory.length, 'messages for switched session');
                          
        // Set first message flag based on whether this is a fresh session
        isFirstMessageInSession = false; // Switching to existing session
                          
        // Reset and load messages in ChatUI
        chatInstance.resetMessages();
        chatInstance.loadMessages(data.history.map(msg => ({
          content: msg.content,
          role: msg.role,
          time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })));
      } else {
        conversationHistory = [];
        chatInstance.resetMessages();
        console.log('🆕 Switched to empty session');
        // This is a new/empty session, so next message will be first
        isFirstMessageInSession = true;
      }
      
    } catch (error) {
      console.error('Failed to load session history:', error);
    } finally {
      // Re-render chat history list to update highlight AFTER everything is loaded
      await loadChatHistory();
      // Hide mobile sidebar after selection
      toggleMobileSidebar(false);
      // Reset loading flag
      isLoadingSession = false;
    }
  });

  // Load chat history from database
  async function loadChatHistory() {
    try {
      console.log('📋 Loading chat history...');
      const response = await fetch('/api/conversations');
      const data = await response.json();
      
      if (data.success && data.sessions && data.sessions.length > 0) {
        console.log('✅ Loaded', data.sessions.length, 'chat sessions from database');
        console.log('📝 Sessions data:', data.sessions);
        
        // Clear existing content FIRST - make absolutely sure
        chatList.el.innerHTML = '';
        console.log('🧹 Cleared chatList DOM, children count:', chatList.ch ? chatList.ch.length : 0);
        
        // Reset el.js children array
        if (chatList.ch) {
          chatList.ch = [];
        }
        
        // Get current session ID to check if it exists in DB
        const activeSessionId = localStorage.getItem('chat_session_id');
        console.log('🔑 Current session from localStorage:', activeSessionId);
        
        // Check if active session exists in the loaded sessions
        const wouldBeActive = data.sessions.some(s => s.session_id === activeSessionId);
        console.log('🔍 Active session exists in DB:', wouldBeActive);
        console.log('📋 Sessions in DB:', data.sessions.map(s => s.session_id));
        
        // IMPORTANT: Don't auto-activate session on load
        // Keep sessionInDb = false until user explicitly selects a session
        // This ensures clean start with no pre-selected session
        // sessionInDb remains false here
        
        // Only highlight if sessionInDb is true (which only happens after user action)
        const effectiveActiveSessionId = sessionInDb ? activeSessionId : null;
        console.log('🎯 Effective active session:', effectiveActiveSessionId);
        
        // Display each session
        data.sessions.forEach((session, index) => {
          // Highlight only if sessionInDb is true AND matches active session ID
          // Since sessionInDb starts as false, NO session will be highlighted on load
          const isActive = sessionInDb && session.session_id === activeSessionId;
          console.log(`📌 Rendering session #${index}:`, session.title, '| ID:', session.session_id, '| Active:', isActive);
          
          const chatItem = el('div')
            .attr('data-session-id', session.session_id)
            .attr('data-session-title', session.title)
            .css({
              'padding': '12px',
              'margin-bottom': '8px',
              'background': isActive ? '#e0f0f5' : 'transparent',
              'border-radius': '8px',
              'cursor': 'pointer',
              'transition': 'background 0.2s',
              'border-left': isActive ? '3px solid #075E54' : '3px solid transparent'
            })
            .hover(
              function() { this.style.background = isActive ? '#d0e8f0' : '#f0f0f0'; },
              function() { this.style.background = isActive ? '#e0f0f5' : 'transparent'; }
            );

          const itemTitle = el('div')
            .text(session.title || 'Untitled Chat')
            .css({
              'font-weight': '600',
              'font-size': '14px',
              'color': '#333',
              'margin-bottom': '4px'
            });

          const itemMeta = el('div')
            .css({
              'display': 'flex',
              'justify-content': 'space-between',
              'align-items': 'center',
              'gap': '8px'
            });

          const messageCount = el('span')
            .text(`${session.message_count || 0} messages`)
            .css({
              'font-size': '11px',
              'color': '#666'
            });

          const itemTime = el('span')
            .text(new Date(session.updated_at).toLocaleString())
            .css({
              'font-size': '11px',
              'color': '#999'
            });

          // Delete button for each session
          const deleteBtn = el('button')
            .html('<i class="fas fa-trash"></i>')
            .attr('title', 'Delete this chat')
            .css({
              'padding': '4px 8px',
              'background': 'transparent',
              'color': '#ff4444',
              'border': '1px solid #ff4444',
              'border-radius': '4px',
              'cursor': 'pointer',
              'font-size': '12px',
              'transition': 'all 0.2s',
              'opacity': '0.7',
              'flex-shrink': '0'
            })
            .hover(
              function() { 
                this.style.background = '#ff4444';
                this.style.color = 'white';
                this.style.opacity = '1';
              },
              function() { 
                this.style.background = 'transparent';
                this.style.color = '#ff4444';
                this.style.opacity = '0.7';
              }
            )
            .click(async function(e) {
              e.stopPropagation(); // Prevent triggering the chat item click

              showDialog(
                'Delete Chat?',
                `Delete "${session.title || 'Untitled Chat'}"? This will permanently delete all messages in this conversation.`,
                async function() {
                  try {
                    console.log('🗑️ Deleting session:', session.session_id);

                    const response = await fetch(`/api/conversations/${session.session_id}`, {
                      method: 'DELETE'
                    });

                    const result = await response.json();

                    if (result.success) {
                      console.log('✅ Session deleted:', session.session_id);

                      // If this was the active session, reset to new session
                      if (session.session_id === currentSessionId) {
                        const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                        localStorage.setItem('chat_session_id', newSessionId);
                        currentSessionId = newSessionId;
                        sessionInDb = false;

                        // Clear chat UI
                        if (chatInstance && chatInstance.resetMessages) {
                          chatInstance.resetMessages();
                        }
                        conversationHistory = [];
                        conversationSummary = '';
                        isFirstMessageInSession = true;

                        console.log('🆕 Created new session after deletion');
                      }

                      // Reload history list
                      await loadChatHistory();
                      showToast('Chat deleted successfully!', 'success');
                    } else {
                      throw new Error('Failed to delete session');
                    }
                  } catch (error) {
                    console.error('❌ Failed to delete session:', error);
                    showToast('Failed to delete chat. Please try again.', 'error');
                  }
                }
              );
            });

          itemMeta.child([messageCount, itemTime, deleteBtn]);
          chatItem.child([itemTitle, itemMeta]);
          chatList.child(chatItem);
          
          console.log('✓ Added to DOM, chatList children:', chatList.ch ? chatList.ch.length : 'N/A');
        });
        
        // Force DOM update
        chatList.get();
        console.log('✅ DOM updated, final child count:', chatList.el.children.length);
      } else {
        console.log('🆕 No chat history found');
        chatList.el.innerHTML = '<div style="text-align:center;color:#999;padding:20px;font-size:13px;">No chat history yet</div>';
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      chatList.el.innerHTML = '<div style="text-align:center;color:#ff6b6b;padding:20px;font-size:13px;">Failed to load history</div>';
    }
  }

  // Chat container area
  const chatContainer = el('div').id('chat-container')
  chatContainer.css({
    'flex': '1',
    'height': '100vh',
    'max-height': '100vh',
    'overflow': 'hidden',
    'background': '#f5f5f5',
    'display': 'flex',
    'flex-direction': 'column',
    'position': 'relative'
  })

  sidebar.child([sidebarHeader, chatList])

  const mobileMenuBtn = el('button')
    .id('mobile-menu-button')
    .text('☰ Menu')
    .click(function() {
      const isOpen = sidebar.el.classList.contains('open');
      toggleMobileSidebar(!isOpen);
    });

  chatContainer.child(mobileMenuBtn);

  // Append sidebar and chatContainer to main container
  container.child([sidebar, chatContainer])
  _app.appendChild(container.get())

  // Load chat history after DOM is ready
  setTimeout(() => {
    loadChatHistory();
  }, 200);

  // Generate or load session ID
  function getSessionId() {
    let sessionId = localStorage.getItem('chat_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chat_session_id', sessionId);
    }
    return sessionId;
  }
  
  // Initialize session ID but don't use it for highlighting until it exists in DB
  let currentSessionId = getSessionId();
  console.log('📋 Initial session ID:', currentSessionId);
  
  // Track whether current session has been saved to DB
  // IMPORTANT: Start as FALSE on every page load
  // This ensures NO session is highlighted on initial load
  // User must manually click a session to activate it
  let sessionInDb = false;
  
  // DO NOT clear localStorage - preserve user's last session preference
  // But also don't auto-highlight on load - let user choose explicitly
  
  // Load conversation history from database
  let conversationHistory = [];
  let conversationSummary = '';
  
  async function loadConversationHistory() {
    try {
      const response = await fetch(`/api/conversations?session_id=${currentSessionId}`);
      const data = await response.json();
      
      if (data.success && data.history && data.history.length > 0) {
        // Convert database format to ChatUI format
        conversationHistory = data.history.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        console.log('✅ Loaded', conversationHistory.length, 'messages from database');
      } else {
        console.log('🆕 New session - no history found');
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  }
  
  // Save message to database with auto-refresh on first message
  let isFirstMessageInSession = true; // Track if this is the first message in a new session
  
  async function saveMessage(role, content) {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          role: role,
          content: content
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✓ Message saved to DB');
        
        // Mark session as existing in DB after first save
        if (!sessionInDb) {
          sessionInDb = true;
          console.log('📝 Session now exists in DB');
        }
        
        // Auto-refresh chat history list when first message is sent in new session
        // This ensures the new session appears in the history sidebar
        if (role === 'user' && isFirstMessageInSession) {
          isFirstMessageInSession = false;
          
          // Refresh history list after a short delay to ensure DB is updated
          setTimeout(async () => {
            console.log('🔄 Auto-refreshing chat history list...');
            await loadChatHistory();
          }, 300);
        }
      }
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }
  
  // Optimized context management for fast Ollama response
  const RECENT_WINDOW = 10; // Keep more recent messages for better context
  const SUMMARY_THRESHOLD = 15; // Higher threshold before summarization kicks in
  const MAX_CONTEXT_TOKENS = 4000; // Optimized for speed (not too large, not too small)
  const AUTO_COMPACT_RATIO = 0.75; // Compact when using 75% of max context
  
  // Estimate tokens (1 token ≈ 4 characters in English)
  function estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }
  
  // Auto-summarize old conversations when approaching context limit
  async function autoSummarize() {
    if (conversationHistory.length < SUMMARY_THRESHOLD) return;
    
    console.log('🔄 Auto-compacting conversation (using', estimateTokens(JSON.stringify(conversationHistory)), 'tokens)...');
    
    // Get messages to summarize (older ones, not recent)
    const messagesToSummarize = conversationHistory.slice(0, -RECENT_WINDOW);
    const recentMessages = conversationHistory.slice(-RECENT_WINDOW);
    
    try {
      const model = window.selectedOllamaModel || 'llama3.2:latest';
      const summaryPrompt = `Summarize this conversation concisely, capturing only key facts, decisions, and important context. Keep it under 3 sentences:\n\n${messagesToSummarize.map(m => `${m.role}: ${m.content}`).join('\n')}`;
      
      const response = await fetch('/api/ollama/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: summaryPrompt,
          stream: false,
          options: {
            num_ctx: 2048 // Small context just for summary
          }
        })
      });
      
      const data = await response.json();
      conversationSummary = data.response || 'Previous conversation covered various topics.';
      
      // Remove summarized messages, keep only recent
      conversationHistory = recentMessages;
      
      console.log('✓ Conversation compacted - reduced from', messagesToSummarize.length + recentMessages.length, 'to', recentMessages.length, 'messages');
    } catch (error) {
      console.error('Failed to auto-summarize:', error);
      // Fallback: just truncate to keep recent messages only
      conversationSummary = 'Previous conversation occurred.';
      conversationHistory = recentMessages;
    }
  }
  
  // Build optimized context with smart management
  function buildContext() {
    const context = [];
    
    // Add summary if exists (as system message at the beginning)
    if (conversationSummary) {
      context.push({ 
        role: 'system', 
        content: `Previous context summary: ${conversationSummary}` 
      });
    }
    
    // Add recent messages within token limit (prioritize most recent)
    let totalTokens = 0;
    const recent = [];
    
    // Iterate from most recent to oldest
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      const tokens = estimateTokens(msg.content);
      
      // Check if adding this message would exceed limit
      if (totalTokens + tokens <= MAX_CONTEXT_TOKENS) {
        recent.unshift(msg); // Add to beginning to maintain order
        totalTokens += tokens;
      } else {
        // Stop when we hit the limit
        console.log('⚠️ Context limit reached at', totalTokens, 'tokens (max:', MAX_CONTEXT_TOKENS + ')');
        break;
      }
    }
    
    const fullContext = [...context, ...recent];
    console.log('📊 Context built:', fullContext.length, 'messages,', totalTokens, 'tokens');
    return fullContext;
  }

  const eljsSystemPrompt = `You are qwen-el, an assistant that understands el.js and the code in this repository.
Only provide el.js code when the user explicitly requests UI implementation, component construction, or asks to make UI with el.js.
For general conversation, greetings, or normal user questions, answer naturally in plain language without code.
Do not output code unless the user explicitly asks for it.
Do not invent any el.js methods that are not in the provided reference.
If you need to add classes, use .class('...') rather than .addClass('...').

Use only these el.js capabilities:
- Wrapper creation: el('tag') creates a new element wrapper.
- Wrapper fields: .el is the raw DOM node, .ch is the queued child array.
- Text / HTML: .text('text'), .textContent('text'), .html('<b>...</b>')
- Attributes: .id(), .name(), .href(), .rel(), .type(), .src(), .placeholder(), .required(), .disabled(), .checked(), .draggable(), .data(name, value), .aria(name, value)
- Styling: .css({ ... }), .style({ ... }), and these shortcuts:
  .width(), .height(), .margin(), .padding(), .border(), .borderTop(), .borderBottom(), .borderLeft(), .borderRight(), .radius(), .background(), .backgroundImage(), .backgroundSize(), .backgroundRepeat(), .backgroundPosition(), .color(), .font(), .fontWeight(), .align(), .size(), .display(), .flex(), .grid(), .justify(), .items(), .self(), .gap(), .wrap(), .cursor(), .opacity(), .zIndex(), .overflow(), .overflowX(), .overflowY(), .boxShadow(), .transform(), .transition(), .lineHeight(), .maxWidth(), .maxHeight(), .minWidth(), .minHeight(), .outline()
- Class helpers: .class('a b'), .clearClass(), .removeClass('a'), .toggleClass('a'), .hasClass('a')
- Event helpers: .on(event, fn), .click(fn), .hover(enterFn, leaveFn), .change(fn), .keydown(fn), .keyup(fn), .keypress(fn), .input(fn), .paste(fn), .focus(fn), .blur(fn), .submit(fn), .mouseover(fn), .mouseout(fn), .mousedown(fn), .mouseup(fn), .touchstart(fn), .touchend(fn), .touchmove(fn), .dblclick(fn), .contextmenu(fn), .wheel(fn), .scroll(fn), .resize(fn), .load(fn), .loopFunc(callback, time)
- DOM helpers: .child(child), .child([child1, child2]), .prepend(child), .remove(), .replace(child), .off(event, fn), .selectAll(), .scrollTo(x, y), .scrollIntoView(options), .empty(), .attrRemove(name), .styleRemove(name), .cssText(text)
- Value getters: .getValue(), .getVal(), .getText(), .getHtml(), .getAttr(name), .getData(name), .getStyle(name), .getParent(), .getChildren(), .getSiblings(), .getIndex(), .getWidth(), .getHeight()
- Traversal: .find(selector), .findAll(selector), .closest(selector), .next(), .prev(), .first(), .last(), .eq(index)
- Linking: .link(obj, name) stores the wrapper's actual DOM node in obj[name].
- Get behavior: .get() appends queued children from .ch into .el and returns the raw DOM node. Do not call el.js wrapper methods after .get().

Examples of valid el.js usage:
- const button = el('button').text('Click me').css({ background: '#4CAF50' }).click(() => alert('clicked'));
  document.body.appendChild(button.get());

Examples of invalid usage to avoid:
- document.body.appendChild(button.get());
  button.get().click(() => alert('clicked'));

Answer with valid el.js code only when the user requests UI code. Otherwise answer in plain language.`;

  // Initialize ChatUI
  const chatInstance = ChatUI({
    type: 'full',
    full: {
      width: '100%',
      height: '100vh'
    },
    borderRadius: '0px',
    boxShadow: 'none',
    background: '#f5f5f5',
    botName: 'Ollama AI',
    botIcon: '🦙',
    primaryColor: '#25D366',
    secondaryColor: '#128C7E',
    onChat: async function(message, streamChunk, sendQuickReply) {
      // Get selected model from dropdown
      const model = window.selectedOllamaModel || 'llama3.2:latest';
      
      console.log('💬 User message:', message);
      console.log('📝 Current conversationHistory length:', conversationHistory.length);
      console.log('📋 Current session ID:', currentSessionId);
      
      // CRITICAL: Always re-fetch conversation history to ensure we're using the correct session's data
      // This is essential when switching between chats to avoid mixing contexts
      try {
        const freshResponse = await fetch(`/api/conversations?session_id=${currentSessionId}`);
        const freshData = await freshResponse.json();
        
        if (freshData.success) {
          const freshHistory = freshData.history.map(msg => ({
            role: msg.role,
            content: msg.content
          }));
          
          // Always use fresh data from database for this session
          // This ensures we're not using stale context from previous session
          conversationHistory = freshHistory;
          console.log('🔄 Loaded fresh history for session:', currentSessionId, '| Messages:', conversationHistory.length);
        }
      } catch (error) {
        console.warn('Failed to fetch fresh conversation history, using cached:', error);
      }
      
      // Build optimized context (summary + recent messages)
      const contextMessages = buildContext();
      
      console.log('Using model:', model);
      console.log('Context: summary=' + (conversationSummary ? '✓' : '✗'), '| recent:', conversationHistory.length, 'messages');
      if (contextMessages.length > 0) {
        console.log('📚 Context messages preview:', contextMessages.slice(-2));
      }
      
      // Add system prompt and current message
      const messagesPayload = [
        { role: 'system', content: eljsSystemPrompt },
        ...contextMessages,
        { role: 'user', content: message }
      ];
      
      const totalTokens = messagesPayload.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
      console.log('Total estimated tokens:', totalTokens);
      
      // Calculate optimal context size for this request
      // Larger context = slower but more memory, smaller = faster but less context
      const optimalContextSize = Math.max(4096, Math.min(totalTokens + 1024, 8192));
      console.log('🎯 Using context size:', optimalContextSize);
      
      const response = await fetch('/api/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: messagesPayload,
          stream: true,
          options: {
            num_ctx: optimalContextSize, // Optimized context window for speed
            temperature: 0.7, // Balanced creativity/coherence
            top_p: 0.9 // Nucleus sampling for quality
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response from Ollama');
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message && data.message.content) {
              const content = data.message.content;
              fullResponse += content;
              streamChunk(content);
            }
            if (data.done) break;
          } catch (e) {
            console.warn('Parse error:', e);
          }
        }
      }

      // Add this exchange to conversation history
      conversationHistory.push({ role: 'user', content: message });
      conversationHistory.push({ role: 'assistant', content: fullResponse });

      // Save to database (async, non-blocking)
      await saveMessage('user', message);
      await saveMessage('assistant', fullResponse);

      // Auto-summarize if we have too many messages
      if (conversationHistory.length >= SUMMARY_THRESHOLD) {
        await autoSummarize();
      }

      console.log('✓ Conversation updated, history:', conversationHistory.length, 'messages');

      return fullResponse;
    }
  })

  // Load history on initialization
  loadConversationHistory();

  // Add ChatUI element to chat container
  chatContainer.get().appendChild(chatInstance.getElement())

}
