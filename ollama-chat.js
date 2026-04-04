import './el.js'
import ChatUI from './chat-ui/chat-ui.js'

const _app = document.getElementById('app');
const HISTORY_SETTING_KEY = 'ollama_chat_history_enabled';
const TEMPERATURE_SETTING_KEY = 'ollama_chat_temperature';
const SYSTEM_PROMPT_SETTING_KEY = 'ollama_chat_system_prompt';
const DEFAULT_SYSTEM_PROMPT = 'You are a professional assistant that helps users with clear, accurate, and respectful answers.';

function createSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function clampTemperature(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0.7;
  }

  return Math.min(2, Math.max(0, numericValue));
}

export default function OllamaChat(config = {}) {
  const defaultHistoryEnabled = config.enableHistory !== false;
  const storedHistorySetting = localStorage.getItem(HISTORY_SETTING_KEY);
  const defaultTemperature = clampTemperature(config.temperature ?? 0.7);
  const storedTemperatureSetting = localStorage.getItem(TEMPERATURE_SETTING_KEY);
  const defaultSystemPrompt = typeof config.systemPrompt === 'string' && config.systemPrompt.trim()
    ? config.systemPrompt.trim()
    : DEFAULT_SYSTEM_PROMPT;
  const storedSystemPrompt = localStorage.getItem(SYSTEM_PROMPT_SETTING_KEY);
  let historyEnabled = storedHistorySetting === null ? defaultHistoryEnabled : storedHistorySetting === 'true';
  let currentTemperature = storedTemperatureSetting === null ? defaultTemperature : clampTemperature(storedTemperatureSetting);
  let currentSystemPrompt = storedSystemPrompt && storedSystemPrompt.trim()
    ? storedSystemPrompt
    : defaultSystemPrompt;
  let runtimeSessionId = createSessionId();

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
    'flex-direction': 'row',
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

      body.history-disabled #sidebar {
        display: none !important;
        visibility: hidden !important;
        transform: translateX(-100%) !important;
      }

      body.history-disabled #mobile-menu-button {
        display: none !important;
      }

      body.history-disabled #sidebar-overlay {
        display: none !important;
      }

      #history-setting-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        background: #f5f5f5;
        border: 1px solid #e0e0e0;
        margin-bottom: 12px;
      }

      #history-setting-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
      }

      #history-setting-label {
        font-size: 12px;
        color: #5f6b6d;
        font-weight: 600;
      }

      #history-setting-status {
        font-size: 12px;
        font-weight: 700;
        color: #075E54;
      }

      #history-setting-toggle {
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 600;
        color: white;
        background: linear-gradient(135deg, #075E54 0%, #128C7E 100%);
        cursor: pointer;
        transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
        white-space: nowrap;
      }

      #history-setting-toggle:hover {
        transform: translateY(-1px);
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

        #mobile-menu-button.is-open {
          background: #c62828;
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

  function updateMobileMenuButton(isSidebarOpen) {
    const menuBtn = document.getElementById('mobile-menu-button');
    if (!menuBtn) {
      return;
    }

    menuBtn.textContent = isSidebarOpen ? '✕ Tutup' : '☰ Menu';
    menuBtn.classList.toggle('is-open', isSidebarOpen);
  }

  function toggleMobileSidebar(show) {
    if (!historyEnabled && show) {
      return;
    }

    if (show) {
      sidebar.el.classList.add('open');
      sidebarOverlay.el.classList.add('visible');
      updateMobileMenuButton(true);
    } else {
      sidebar.el.classList.remove('open');
      sidebarOverlay.el.classList.remove('visible');
      updateMobileMenuButton(false);
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

  const temperatureGroup = el('div')
    .css({
      'display': 'flex',
      'flex-direction': 'column',
      'gap': '8px',
      'padding': '10px 12px',
      'border-radius': '10px',
      'background': 'rgba(255,255,255,0.12)'
    });

  const temperatureHeader = el('div')
    .css({
      'display': 'flex',
      'justify-content': 'space-between',
      'align-items': 'center',
      'gap': '10px'
    });

  const temperatureLabel = el('label')
    .text('Temperature')
    .css({
      'font-size': '13px',
      'opacity': '0.95'
    });

  const temperatureValue = el('span')
    .css({
      'font-size': '12px',
      'font-weight': '700',
      'padding': '3px 8px',
      'border-radius': '999px',
      'background': 'rgba(255,255,255,0.18)',
      'color': 'white'
    });

  const temperatureHint = el('div')
    .text('Rendah = lebih konsisten, tinggi = lebih kreatif')
    .css({
      'font-size': '11px',
      'opacity': '0.8',
      'line-height': '1.4'
    });

  const temperatureInput = el('input')
    .attr('type', 'range')
    .attr('min', '0')
    .attr('max', '2')
    .attr('step', '0.1')
    .value(String(currentTemperature))
    .css({
      'width': '100%',
      'accent-color': '#25D366',
      'cursor': 'pointer'
    })
    .input(function() {
      setTemperature(this.value);
    })
    .change(function() {
      setTemperature(this.value);
    });

  function setTemperature(nextValue) {
    currentTemperature = clampTemperature(nextValue);
    localStorage.setItem(TEMPERATURE_SETTING_KEY, String(currentTemperature));
    temperatureInput.el.value = String(currentTemperature);
    temperatureValue.text(currentTemperature.toFixed(1));
  }

  setTemperature(currentTemperature);

  temperatureHeader.child([temperatureLabel, temperatureValue]);
  temperatureGroup.child([temperatureHeader, temperatureInput, temperatureHint]);

  const systemPromptGroup = el('div')
    .css({
      'display': 'flex',
      'flex-direction': 'column',
      'gap': '8px',
      'padding': '10px 12px',
      'border-radius': '10px',
      'background': 'rgba(255,255,255,0.12)'
    });

  const systemPromptLabel = el('label')
    .text('System Prompt')
    .css({
      'font-size': '13px',
      'opacity': '0.95'
    });

  const systemPromptInput = el('textarea')
    .attr('rows', '4')
    .css({
      'width': '100%',
      'resize': 'vertical',
      'min-height': '86px',
      'max-height': '180px',
      'border': 'none',
      'border-radius': '8px',
      'padding': '10px',
      'font-size': '12px',
      'line-height': '1.45',
      'outline': 'none',
      'background': 'rgba(255,255,255,0.95)',
      'color': '#1f2d2e'
    });

  const systemPromptHint = el('div')
    .text('Prompt ini dipakai di setiap request ke model.')
    .css({
      'font-size': '11px',
      'opacity': '0.8'
    });

  const systemPromptActions = el('div')
    .css({
      'display': 'flex',
      'gap': '8px',
      'justify-content': 'flex-end'
    });

  const systemPromptResetBtn = el('button')
    .text('Reset')
    .css({
      'padding': '6px 10px',
      'border': 'none',
      'border-radius': '8px',
      'font-size': '12px',
      'cursor': 'pointer',
      'background': 'rgba(255,255,255,0.3)',
      'color': 'white'
    });

  const systemPromptSaveBtn = el('button')
    .text('Simpan')
    .css({
      'padding': '6px 10px',
      'border': 'none',
      'border-radius': '8px',
      'font-size': '12px',
      'cursor': 'pointer',
      'background': '#25D366',
      'color': 'white',
      'font-weight': '600'
    });

  function setSystemPrompt(nextPrompt, persist = true) {
    const normalizedPrompt = (nextPrompt || '').trim() || DEFAULT_SYSTEM_PROMPT;
    currentSystemPrompt = normalizedPrompt;
    systemPromptInput.value(normalizedPrompt);

    if (persist) {
      localStorage.setItem(SYSTEM_PROMPT_SETTING_KEY, normalizedPrompt);
    }
  }

  systemPromptSaveBtn.click(function() {
    setSystemPrompt(systemPromptInput.el.value, true);
    showToast('System prompt berhasil disimpan', 'success');
  });

  systemPromptResetBtn.click(function() {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT, true);
    showToast('System prompt kembali ke default', 'info');
  });

  setSystemPrompt(currentSystemPrompt, false);

  systemPromptActions.child([systemPromptResetBtn, systemPromptSaveBtn]);
  systemPromptGroup.child([systemPromptLabel, systemPromptInput, systemPromptHint, systemPromptActions]);

  const historySettingCard = el('div')
    .id('history-setting-bar');

  const historySettingText = el('div')
    .id('history-setting-text');

  const historySettingLabel = el('span')
    .id('history-setting-label')
    .text('Memory percakapan');

  const historySettingStatus = el('span')
    .id('history-setting-status');

  const historyToggleBtn = el('button')
    .id('history-setting-toggle')
    .click(function() {
      setHistoryEnabled(!historyEnabled);
    });

  historySettingText.child([historySettingLabel, historySettingStatus]);
  historySettingCard.child([historySettingText, historyToggleBtn]);
  
  modelSelectorContainer.child([modelLabel, modelSelect, modelLoading, temperatureGroup, systemPromptGroup, historySettingCard]);

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
      if (!historyEnabled) {
        return;
      }

      console.log('🆕 Creating new chat session...');
      
      // Generate new session ID
      const newSessionId = createSessionId();
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
    if (!historyEnabled) {
      return;
    }

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
    if (!historyEnabled) {
      chatList.el.innerHTML = '<div style="text-align:center;color:#666;padding:20px;font-size:13px;">History dimatikan</div>';
      return;
    }

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
      if (!historyEnabled) {
        return;
      }

      const isOpen = sidebar.el.classList.contains('open');
      toggleMobileSidebar(!isOpen);
    });

  chatContainer.child(mobileMenuBtn);
  updateMobileMenuButton(false);

  // Append sidebar and chatContainer to main container
  container.child([sidebar, chatContainer])
  _app.appendChild(container.get())

  // Load chat history after DOM is ready
  setTimeout(() => {
    loadChatHistory();
  }, 200);

  // Generate or load session ID
  function getSessionId() {
    if (!historyEnabled) {
      return runtimeSessionId;
    }

    let sessionId = localStorage.getItem('chat_session_id');
    if (!sessionId) {
      sessionId = createSessionId();
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

  function updateHistorySettingUI() {
    historySettingStatus.text(historyEnabled ? 'Aktif' : 'Nonaktif');
    historyToggleBtn.text(historyEnabled ? 'Matikan' : 'Hidupkan');
    historyToggleBtn.el.style.background = historyEnabled
      ? 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)'
      : 'linear-gradient(135deg, #7f8c8d 0%, #95a5a6 100%)';
    newChatBtn.disabled(historyEnabled ? false : true);
    newChatBtn.el.style.opacity = historyEnabled ? '1' : '0.5';
    newChatBtn.el.style.cursor = historyEnabled ? 'pointer' : 'not-allowed';

    if (historyEnabled) {
      document.body.classList.remove('history-disabled');
    } else {
      document.body.classList.add('history-disabled');
      toggleMobileSidebar(false);
    }
  }

  async function loadCurrentSessionIntoChat() {
    if (!historyEnabled) {
      return;
    }

    try {
      const response = await fetch(`/api/conversations?session_id=${currentSessionId}`);
      const data = await response.json();

      if (data.success && data.history && data.history.length > 0) {
        conversationHistory = data.history.map(msg => ({
          role: msg.role,
          content: msg.content
        }));

        chatInstance.resetMessages();
        chatInstance.loadMessages(data.history.map(msg => ({
          content: msg.content,
          role: msg.role,
          time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })));
        isFirstMessageInSession = false;
      } else {
        conversationHistory = [];
        conversationSummary = '';
        isFirstMessageInSession = true;
        chatInstance.resetMessages();
      }
    } catch (error) {
      console.error('Failed to load current session into chat:', error);
    }
  }

  async function setHistoryEnabled(nextValue) {
    historyEnabled = nextValue;
    localStorage.setItem(HISTORY_SETTING_KEY, String(historyEnabled));
    updateHistorySettingUI();

    if (!historyEnabled) {
      runtimeSessionId = createSessionId();
      currentSessionId = runtimeSessionId;
      sessionInDb = false;
      conversationHistory = [];
      conversationSummary = '';
      isFirstMessageInSession = true;
      chatInstance.resetMessages();
      await loadChatHistory();
      showToast('History dimatikan. Chat berikutnya tidak akan diingat.', 'info');
      return;
    }

    currentSessionId = getSessionId();
    sessionInDb = false;
    conversationHistory = [];
    conversationSummary = '';
    isFirstMessageInSession = true;
    await loadChatHistory();
    await loadCurrentSessionIntoChat();
    showToast('History dihidupkan. Percakapan bisa disimpan dan dipakai sebagai context.', 'success');
  }
  
  async function loadConversationHistory() {
    if (!historyEnabled) {
      return;
    }

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
    if (!historyEnabled) {
      return;
    }

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
    if (!historyEnabled) {
      return [];
    }

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
      if (historyEnabled) {
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
        { role: 'system', content: currentSystemPrompt },
        ...contextMessages,
        { role: 'user', content: message }
      ];
      
      const totalTokens = messagesPayload.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
      console.log('Total estimated tokens:', totalTokens);
      
      // Calculate optimal context size for this request
      // Larger context = slower but more memory, smaller = faster but less context
      const optimalContextSize = Math.max(4096, Math.min(totalTokens + 1024, 8192));
      console.log('🎯 Using context size:', optimalContextSize);
      console.log('🌡️ Using temperature:', currentTemperature);
      
      const response = await fetch('/api/ollama/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: messagesPayload,
          stream: true,
          options: {
            num_ctx: optimalContextSize, // Optimized context window for speed
            temperature: currentTemperature,
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
      if (historyEnabled) {
        conversationHistory.push({ role: 'user', content: message });
        conversationHistory.push({ role: 'assistant', content: fullResponse });

        // Save to database (async, non-blocking)
        await saveMessage('user', message);
        await saveMessage('assistant', fullResponse);

        // Auto-summarize if we have too many messages
        if (conversationHistory.length >= SUMMARY_THRESHOLD) {
          await autoSummarize();
        }
      }

      console.log('✓ Conversation updated, history:', conversationHistory.length, 'messages');

      return fullResponse;
    }
  })

  updateHistorySettingUI();

  // Load history on initialization
  if (historyEnabled) {
    loadConversationHistory();
  }

  // Add ChatUI element to chat container
  chatContainer.get().appendChild(chatInstance.getElement())

}
