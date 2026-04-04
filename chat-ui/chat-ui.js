// Chat UI App using el.js
// Export as ES module for import in index.html
// Implemented with proper el.js chainable patterns and advanced features

let messages = [];
let nextId = 1;
let conversationHistory = []; // Track conversation for context-aware responses

const ChatUI = function(config = {}) {
    // Default colors
    const colors = {
        primaryColor: config.primaryColor || '#25D366',
        secondaryColor: config.secondaryColor || '#128C7E',
        userMessageColor: config.userMessageColor || '#DCF8C6',
        botAvatarColor1: config.botAvatarColor1 || '#00A884',
        botAvatarColor2: config.botAvatarColor2 || '#25D366',
        headerGradient1: config.headerGradient1 || '#075E54',
        headerGradient2: config.headerGradient2 || '#128C7E'
    };
    
    const chatType = config.type || 'full'; // 'full' or 'popup'
    
    // Create main container
    const container = el('div')
        .id('chat-app')
        .css({
            'max-width': chatType === 'full' ? config.full?.width || '800px' : config.popup?.width || '350px',
            'max-height': chatType === 'full' ? '100vh' : config.popup?.height || '450px',
            'margin': chatType === 'full' ? 'auto' : '0',
            'padding': '0',
            'background': config.background || '#fff',
            'border-radius': config.borderRadius !== undefined ? config.borderRadius : (chatType === 'full' ? '12px' : '12px'),
            'box-shadow': config.boxShadow || (chatType === 'full' ? '0 4px 20px rgba(0,0,0,0.15)' : '0 0 20px rgba(0,0,0,0.3)'),
            'height': chatType === 'full' ? config.full?.height || '600px' : config.popup?.height || '450px',
            'width': chatType === 'full' ? '100%' : config.popup?.width || '350px',
            'display': 'flex',
            'flex-direction': 'column',
            'overflow': 'hidden',
            'position': chatType === 'popup' ? 'fixed' : 'relative',
            'bottom': chatType === 'popup' ? '80px' : 'auto',
            'right': chatType === 'popup' ? '20px' : 'auto',
            'z-index': chatType === 'popup' ? '9999' : '1'
        });
        
    // If popup mode, create toggle button and initially hide chat
    let isChatOpen = false;
    let toggleButton;
        
    if (chatType === 'popup') {
        container.hide();
            
        // Create floating action button
        toggleButton = el('button')
            .html('<i class="fas fa-comments"></i>')
            .css({
                'position': 'fixed',
                'bottom': '20px',
                'right': '20px',
                'width': '60px',
                'height': '60px',
                'border-radius': '50%',
                'background': `linear-gradient(135deg, ${colors.primaryColor} 0%, ${colors.secondaryColor} 100%)`,
                'color': 'white',
                'border': 'none',
                'cursor': 'pointer',
                'font-size': '24px',
                'box-shadow': '0 4px 15px rgba(0,0,0,0.3)',
                'z-index': '10000',
                'transition': 'transform 0.2s'
            })
            .click(function() {
                if (isChatOpen) {
                    container.hide();
                    toggleButton.show();
                } else {
                    container.show();
                    toggleButton.hide();
                    messagesContainer.el.scrollTop = messagesContainer.el.scrollHeight;
                }
                isChatOpen = !isChatOpen;
            })
            .hover(
                function() { this.style.transform = 'scale(1.1)'; },
                function() { this.style.transform = 'scale(1)'; }
            );
            
        document.body.appendChild(toggleButton.get());
    }
        
    // Create header with gradient
    const header = el('div')
        .css({
            'padding': '20px',
            'background': `linear-gradient(135deg, ${colors.headerGradient1} 0%, ${colors.headerGradient2} 100%)`,
            'color': 'white',
            'display': 'flex',
            'align-items': 'center',
            'gap': '15px',
            'box-shadow': '0 2px 10px rgba(0,0,0,0.1)',
            'position': 'relative'
        });

    const avatar = el('div')
        .css({
            'width': '45px',
            'height': '45px',
            'border-radius': '50%',
            'background': `linear-gradient(135deg, ${colors.botAvatarColor1} 0%, ${colors.botAvatarColor2} 100%)`,
            'display': 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'font-size': '24px',
            'font-weight': 'bold',
            'color': 'white'
        })
        .text(config.botIcon || '🤖');

    const headerInfo = el('div')
        .css({
            'flex': '1'
        });

    // Add close button for popup mode
    let closeButton;
    if (chatType === 'popup') {
        closeButton = el('button')
            .html('<i class="fas fa-times"></i>')
            .css({
                'position': 'absolute',
                'top': '15px',
                'right': '15px',
                'width': '30px',
                'height': '30px',
                'border-radius': '50%',
                'background': 'rgba(255,255,255,0.2)',
                'color': 'white',
                'border': 'none',
                'cursor': 'pointer',
                'font-size': '16px',
                'display': 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                'transition': 'background 0.2s'
            })
            .click(function() {
                container.hide();
                toggleButton.show();
                isChatOpen = false;
            })
            .hover(
                function() { this.style.background = 'rgba(255,255,255,0.3)'; },
                function() { this.style.background = 'rgba(255,255,255,0.2)'; }
            );
    }

    const chatTitle = el('h2')
        .text(config.botName || 'AI Assistant')
        .css({
            'margin': '0',
            'font-size': '18px',
            'font-weight': '600'
        });

    const statusText = el('p')
        .text('Online')
        .css({
            'margin': '5px 0 0 0',
            'font-size': '13px',
            'opacity': '0.9'
        });

    // Create messages container with scroll
    const messagesContainer = el('div')
        .id('container')
        .css({
            'flex': chatType === 'popup' ? '0' : '1',
            'padding': chatType === 'popup' ? '20px 20px 10px 20px' : '20px',
            'overflow-y': 'auto',
            'min-height': chatType === 'popup' ? '280px' : '0',
            'max-height': chatType === 'popup' ? '280px' : 'none',
            'height': chatType === 'popup' ? '280px' : 'auto',
            'background': '#f5f5f5'
        });

    // Create message input area
    const inputArea = el('div')
        .css({
            'padding': chatType === 'popup' ? '15px 20px' : '20px',
            'background': 'white',
            'border-top': '1px solid #e0e0e0',
            'display': 'flex',
            'gap': '10px',
            'align-items': 'flex-end',
            'flex-shrink': '0'
        });

    const messageInput = el('textarea')
        .placeholder('Type your message... (Shift+Enter untuk baris baru)')
        .css({
            'flex': '1',
            'padding': '12px 16px',
            'border': '2px solid #e0e0e0',
            'border-radius': '24px',
            'font-size': '15px',
            'outline': 'none',
            'transition': 'border-color 0.3s',
            'min-height': '48px',
            'max-height': '140px',
            'resize': 'vertical'
        })
        .focus(function() {
            this.style.borderColor = colors.primaryColor;
        })
        .blur(function() {
            this.style.borderColor = '#e0e0e0';
        })
        .keydown(function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

    const sendButton = el('button')
        .html('<i class="fas fa-paper-plane"></i>')
        .css({
            'width': '45px',
            'height': '45px',
            'border-radius': '50%',
            'background': `linear-gradient(135deg, ${colors.primaryColor} 0%, ${colors.secondaryColor} 100%)`,
            'color': 'white',
            'border': 'none',
            'cursor': 'pointer',
            'font-size': '18px',
            'display': 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'transition': 'transform 0.2s'
        })
        .click(sendMessage)
        .hover(
            function() { this.style.transform = 'scale(1.1)'; },
            function() { this.style.transform = 'scale(1)'; }
        );

    // Add typing indicator element (initially hidden)
    const typingIndicator = el('div')
        .css({
            'padding': '12px 16px',
            'margin-bottom': '15px',
            'background': 'white',
            'border-radius': '18px',
            'display': 'inline-block',
            'box-shadow': '0 2px 8px rgba(0,0,0,0.08)'
        })
        .hide();

    const typingDots = el('div')
        .css({
            'display': 'flex',
            'gap': '4px'
        })
        .html(`
            <div style="width:8px;height:8px;background:${colors.primaryColor};border-radius:50%;animation:bounce 1.4s infinite ease-in-out both"></div>
            <div style="width:8px;height:8px;background:${colors.primaryColor};border-radius:50%;animation:bounce 1.4s infinite ease-in-out both;animation-delay:-0.32s"></div>
            <div style="width:8px;height:8px;background:${colors.primaryColor};border-radius:50%;animation:bounce 1.4s infinite ease-in-out both;animation-delay:-0.16s"></div>
        `);

    typingIndicator.child(typingDots);

    function copyTextToClipboard(text) {
        // Prefer modern Clipboard API when available in secure contexts.
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).catch(() => {
                return fallbackCopyText(text);
            });
        }
        return fallbackCopyText(text);
    }

    function fallbackCopyText(text) {
        return new Promise((resolve, reject) => {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'fixed';
                textarea.style.top = '-1000px';
                textarea.style.left = '-1000px';

                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();

                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);

                if (successful) {
                    resolve();
                } else {
                    reject(new Error('Fallback copy command failed'));
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    function showInlineToast(message, duration = 2200) {
        const toastEl = el('div')
            .text(message)
            .css({
                'position': 'fixed',
                'bottom': '24px',
                'left': '50%',
                'transform': 'translateX(-50%)',
                'padding': '10px 16px',
                'background': 'rgba(33,33,33,0.92)',
                'color': '#fff',
                'border-radius': '999px',
                'font-size': '13px',
                'z-index': '10001',
                'opacity': '0',
                'transition': 'opacity 0.2s ease'
            });

        document.body.appendChild(toastEl.get());
        requestAnimationFrame(() => { toastEl.el.style.opacity = '1'; });
        setTimeout(() => {
            toastEl.el.style.opacity = '0';
            setTimeout(() => {
                if (toastEl.el.parentNode) toastEl.el.parentNode.removeChild(toastEl.el);
            }, 220);
        }, duration);
    }

    function renderTextWithCode(text, message) {
        const wrapper = el('div').css({ 'display': 'flex', 'flex-direction': 'column', 'gap': '12px' });
        const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;

        while ((match = codeRegex.exec(text)) !== null) {
            const beforeText = text.slice(lastIndex, match.index);
            if (beforeText) {
                wrapper.child(
                    el('div')
                        .css({ 'white-space': 'pre-wrap', 'line-height': '1.6', 'color': message.isUser ? '#000' : '#333' })
                        .text(beforeText)
                );
            }

            const codeText = match[2];
            const codeBlock = el('div').css({ 'position': 'relative', 'margin-top': '8px' });
            const pre = el('pre').css({
                'margin': '0',
                'padding': '14px',
                'background': '#1e1e1e',
                'color': '#f8f8f2',
                'border-radius': '14px',
                'overflow-x': 'auto',
                'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                'font-size': '13px',
                'line-height': '1.5'
            });
            pre.child(
                el('code').text(codeText)
            );

            const copyBtn = el('button')
                .text('Copy')
                .css({
                    'position': 'absolute',
                    'top': '10px',
                    'right': '10px',
                    'padding': '6px 10px',
                    'font-size': '12px',
                    'color': '#111',
                    'background': '#f2f2f2',
                    'border': 'none',
                    'border-radius': '999px',
                    'cursor': 'pointer'
                })
                .click(async function() {
                    try {
                        await copyTextToClipboard(codeText);
                        showInlineToast('Code copied to clipboard');
                    } catch (err) {
                        showInlineToast('Copy failed', 2600);
                    }
                });

            codeBlock.child([pre, copyBtn]);
            wrapper.child(codeBlock);
            lastIndex = codeRegex.lastIndex;
        }

        const restText = text.slice(lastIndex);
        if (restText) {
            wrapper.child(
                el('div')
                    .css({ 'white-space': 'pre-wrap', 'line-height': '1.6', 'color': message.isUser ? '#000' : '#333' })
                    .text(restText)
            );
        }

        return wrapper;
    }

    // Function to create a message bubble using el.js patterns
    function createMessageBubble(message) {
        const messageWrapper = el('div')
            .css({
                'display': 'flex',
                'margin-bottom': '15px',
                'flex-direction': message.isUser ? 'row-reverse' : 'row'
            });

        const messageContent = el('div')
            .css({
                'max-width': '70%',
                'padding': '8px 12px',
                'border-radius': '8px',
                'background': message.isUser ? colors.userMessageColor : 'white',
                'color': message.isUser ? '#000000' : '#333333',
                'box-shadow': '0 1px 2px rgba(0,0,0,0.1)',
                'word-wrap': 'break-word',
                'position': 'relative'
            });
        
        // Support text, HTML string, or el.js object
        if (message.el && typeof message.el.get === 'function') {
            // If message is el.js object, use it directly
            messageContent.child(message.el);
        } else if (message.html) {
            // If message has HTML, render as HTML
            messageContent.html(message.html);
        } else if (typeof message.text === 'string' && /```/.test(message.text)) {
            // Render code blocks with a copy button
            messageContent.child(renderTextWithCode(message.text, message));
        } else {
            // Default: render as text
            messageContent.text(message.text);
        }

        // Add triangular pointer (speech bubble tail)
        const triangleSize = '6px';
        const triangleColor = message.isUser ? colors.userMessageColor : 'white';
        const trianglePosition = message.isUser ? 
            { right: '-6px', borderLeft: `${triangleSize} solid ${triangleColor}` } :
            { left: '-6px', borderRight: `${triangleSize} solid ${triangleColor}` };
        
        const triangle = el('div')
            .css({
                'width': '0',
                'height': '0',
                'border-top': `${triangleSize} solid transparent`,
                'border-bottom': `${triangleSize} solid transparent`,
                [message.isUser ? 'borderLeft' : 'borderRight']: `${triangleSize} solid ${triangleColor}`,
                'position': 'absolute',
                'top': '10px',
                [message.isUser ? 'right' : 'left']: '-6px'
            });

        messageContent.prepend(triangle);

        const messageMeta = el('div')
            .css({
                'font-size': '11px',
                'opacity': '0.6',
                'margin-top': '4px',
                'text-align': 'right'
            })
            .text(message.time);

        messageContent.child(messageMeta);
        messageWrapper.child(messageContent);
        
        return messageWrapper;
    }

    // Function to send a message
    function sendMessage() {
        const text = messageInput.el.value.trim();
        if (text === '') {
            return;
        }

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const userMessage = {
            id: nextId++,
            text: text,
            isUser: true,
            time: time
        };

        messages.push(userMessage);
        conversationHistory.push({ role: 'user', text: text });
        messageInput.el.value = '';
        renderMessages();

        // Show typing indicator
        showTypingIndicator();

        // Get bot response (from callback or built-in)
        const delay = config.typingDelay || (1000 + Math.random() * 1500);
        
        setTimeout(async () => {
            let responseText = '';
            let isStreaming = false;
            
            // Try to get response from onChat callback if provided
            if (config.onChat && typeof config.onChat === 'function') {
                try {
                    const result = await config.onChat(text, (chunk) => {
                        // Streaming callback - called for each chunk
                        if (!isStreaming) {
                            hideTypingIndicator();
                            isStreaming = true;
                            // Add empty message that will be filled
                            const botResponse = {
                                id: nextId++,
                                text: '',
                                isUser: false,
                                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            };
                            messages.push(botResponse);
                        }
                        // Update last message with new chunk
                        responseText += chunk;
                        messages[messages.length - 1].text = responseText;
                        renderMessages();
                    }, (message) => {
                        // sendQuickReply function - accessible within onChat scope
                        window.sendQuickReply(message);
                    });
                    
                    // If not streaming, use returned value
                    if (!isStreaming) {
                        hideTypingIndicator();
                        responseText = result;
                    } else {
                        // Streaming complete
                        conversationHistory.push({ role: 'bot', text: responseText });
                        return;
                    }
                } catch (error) {
                    console.error('Error in onChat callback:', error);
                    hideTypingIndicator();
                    responseText = config.retryMessage || "Sorry, an error occurred. Please try again.";
                }
            } else {
                // No onChat callback, use built-in responses
                hideTypingIndicator();
                responseText = getBotResponse(text);
            }
            
            // Fallback to built-in responses if callback returns null/undefined
            if (!responseText && !isStreaming) {
                hideTypingIndicator();
                responseText = getBotResponse(text);
            }
            
            // Only add message if not streaming (streaming adds message during callback)
            if (!isStreaming) {
                const botResponse = {
                    id: nextId++,
                    isUser: false,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                
                // Handle different response types
                if (typeof responseText === 'string') {
                    // String response (plain text or HTML)
                    if (responseText.trim().startsWith('<') && responseText.trim().includes('>')) {
                        // HTML string
                        botResponse.html = responseText;
                    } else {
                        // Plain text
                        botResponse.text = responseText;
                    }
                } else if (responseText && typeof responseText === 'object') {
                    // Object response - check for el.js object
                    if (responseText.el && typeof responseText.el.get === 'function') {
                        // el.js object
                        botResponse.el = responseText.el;
                    } else {
                        // Fallback to text representation
                        botResponse.text = JSON.stringify(responseText);
                    }
                } else {
                    // Default fallback
                    botResponse.text = responseText || getBotResponse(text);
                }
                
                messages.push(botResponse);
                conversationHistory.push({ role: 'bot', text: responseText });
                renderMessages();
            }
        }, delay);
    }

    // Expose quick reply function to global scope for HTML buttons
    window.sendQuickReply = function(message) {
        // Scroll to bottom first
        messagesContainer.el.scrollTop = messagesContainer.el.scrollHeight;
        
        // Send the message
        messageInput.el.value = message;
        sendMessage();
    };

    // Show typing indicator
    function showTypingIndicator() {
        const indicatorWrapper = el('div')
            .css({
                'display': 'flex',
                'margin-bottom': '15px',
                'flex-direction': 'row'
            })
            .child([
                typingIndicator
            ]);
        
        messagesContainer.child(indicatorWrapper);
        messagesContainer.get();
        messagesContainer.el.scrollTop = messagesContainer.el.scrollHeight;
        
        // Make sure typing indicator is visible
        typingIndicator.show();
    }

    // Hide typing indicator
    function hideTypingIndicator() {
        typingIndicator.hide();
    }

    // Advanced bot responses with context awareness
    function getBotResponse(userMessage) {
        const lowerMessage = userMessage.toLowerCase();
        
        // Greeting responses
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
            const greetings = [
                'Hello! How can I help you today? 😊',
                'Hi there! What would you like to chat about?',
                'Hey! Great to see you. How can I assist you?'
            ];
            return getRandomResponse(greetings);
        }
        
        // How are you responses
        if (lowerMessage.includes('how are you')) {
            return "I'm doing great! Thanks for asking. What would you like to chat about?";
        }
        
        // Name/bot identity responses
        if (lowerMessage.includes('your name') || lowerMessage.includes('who are you')) {
            return "I'm AI Assistant, here to help you with anything you need! 🤖";
        }
        
        // Farewell responses
        if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || lowerMessage.includes('see you')) {
            const farewells = [
                'Goodbye! Have a great day! 👋',
                'Bye! Feel free to come back anytime!',
                'See you later! Take care!'
            ];
            return getRandomResponse(farewells);
        }
        
        // Thank you responses
        if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
            const thanks = [
                "You're welcome! Feel free to ask me anything.",
                "Happy to help! Anything else you'd like to know?",
                "No problem at all! I'm here whenever you need help!"
            ];
            return getRandomResponse(thanks);
        }
        
        // Help requests
        if (lowerMessage.includes('help')) {
            return "I'm here to help! You can ask me questions or just chat with me. I'll do my best to assist you! 💡";
        }
        
        // Time/date questions
        if (lowerMessage.includes('time') || lowerMessage.includes('date')) {
            const now = new Date();
            return `Current time is ${now.toLocaleTimeString()} on ${now.toLocaleDateString()} 📅`;
        }
        
        // Joke request
        if (lowerMessage.includes('joke') || lowerMessage.includes('funny')) {
            const jokes = [
                "Why don't scientists trust atoms? Because they make up everything! 😄",
                "What do you call a fake noodle? An impasta! 🍝",
                "Why did the scarecrow win an award? He was outstanding in his field! 🌾"
            ];
            return getRandomResponse(jokes);
        }
        
        // Weather question
        if (lowerMessage.includes('weather')) {
            return "I don't have access to real-time weather data, but I hope it's pleasant where you are! ☀️🌧️";
        }
        
        // Age question
        if (lowerMessage.includes('how old') || lowerMessage.includes('age')) {
            return "I'm ageless - I exist in the digital realm! But I'm always learning and growing. 🌟";
        }
        
        // Favorites
        if (lowerMessage.includes('favorite color')) {
            return "I quite like purple - it's the color of creativity and wisdom! 💜";
        }
        
        if (lowerMessage.includes('favorite food')) {
            return "I don't eat, but I've heard pizza is universally loved! 🍕";
        }
        
        // Context-aware follow-up (check last bot message)
        if (conversationHistory.length > 0) {
            const lastExchange = conversationHistory[conversationHistory.length - 1];
            if (lastExchange.role === 'bot') {
                // User is responding to bot's previous message
                const followups = [
                    "That's interesting! Tell me more about that.",
                    "I see! What else is on your mind?",
                    "Thanks for sharing! Is there anything specific you'd like to discuss?"
                ];
                return getRandomResponse(followups);
            }
        }
        
        // Default contextual responses based on message length
        if (userMessage.length < 10) {
            // Short message
            const shortResponses = [
                "Tell me more! 😊",
                "I'm listening... 👂",
                "What else? 💭"
            ];
            return getRandomResponse(shortResponses);
        } else if (userMessage.includes('?')) {
            // Question detected
            const questionResponses = [
                "That's a great question! Let me think about it...",
                "Interesting question! Here's what I think...",
                "Good question! I'd say it depends on the situation."
            ];
            return getRandomResponse(questionResponses);
        } else {
            // Standard default responses
            const defaultResponses = [
                "That's interesting! Tell me more.",
                "I understand. What else would you like to discuss?",
                "Thanks for sharing! Is there anything specific you'd like to know?",
                "I see! Feel free to ask me anything.",
                "That's a great point! How can I assist you further?"
            ];
            return getRandomResponse(defaultResponses);
        }
    }

    // Helper function to get random response from array
    function getRandomResponse(responses) {
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Function to render messages using el.js patterns
    function renderMessages() {
        // Clear existing content
        messagesContainer.el.innerHTML = '';

        if (messages.length === 0) {
            const emptyMessage = el('div')
                .css({
                    'text-align': 'center',
                    'color': '#999',
                    'padding': '40px 20px',
                    'font-style': 'italic'
                });

            const icon = el('div')
                .css({
                    'font-size': '48px',
                    'margin-bottom': '15px'
                })
                .text('💬');

            const title = el('p')
                .css({
                    'font-size': '18px',
                    'margin': '0 0 10px 0',
                    'color': '#666'
                })
                .text('Welcome to Chat!');

            const subtitle = el('p')
                .css({
                    'margin': '0',
                    'font-size': '14px'
                })
                .text('Start a conversation by typing a message below.');

            emptyMessage.child([icon, title, subtitle]);
            messagesContainer.el.appendChild(emptyMessage.get());
        } else {
            messages.forEach(message => {
                const messageElement = createMessageBubble(message);
                messagesContainer.el.appendChild(messageElement.get());
            });
        }
        
        // Scroll to bottom after rendering
        setTimeout(() => {
            messagesContainer.el.scrollTop = messagesContainer.el.scrollHeight;
        }, 50);
    }

    // Add CSS animation for message slide-in and typing indicator
    const styleEl = el('style')
        .html(`
            /* CSS Reset - Scoped to Chat UI only */
            #chat-app, #chat-app *, #chat-app *::before, #chat-app *::after {
                box-sizing: border-box;
            }
            
            #chat-app {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.5;
            }
            
            #chat-app button {
                font-family: inherit;
                cursor: pointer;
            }
            
            #chat-app input {
                font-family: inherit;
            }
            
            /* Chat message interactive elements */
            #chat-app .message-content a {
                color: ${colors.primaryColor};
                text-decoration: none;
                font-weight: 500;
            }
            
            #chat-app .message-content a:hover {
                text-decoration: underline;
            }
            
            #chat-app .message-content button {
                background: ${colors.primaryColor};
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                margin: 4px 2px;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            #chat-app .message-content button:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }
            
            #chat-app .message-content .quick-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 8px;
            }
            
            @keyframes messageSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes bounce {
                0%, 80%, 100% {
                    transform: scale(0);
                }
                40% {
                    transform: scale(1);
                }
            }
        `);

    // Build the app using proper el.js chaining
    // Each parent collects children via .child() method
    headerInfo.child([chatTitle, statusText]);
    
    if (chatType === 'popup' && closeButton) {
        header.child([avatar, headerInfo, closeButton]);
    } else {
        header.child([avatar, headerInfo]);
    }
    inputArea.child([messageInput, sendButton]);
    container.child([header, messagesContainer, inputArea]);
    
    // Append style to document head
    document.head.appendChild(styleEl.get());
    
    // Call get() to append all children to their parents
    container.get();

    // Initial render
    renderMessages();

    // Return the container element with public API
    return {
        getElement: function() {
            return container.get();
        },
        sendMessage: sendMessage,
        getMessages: function() {
            return messages;
        },
        addMessage: function(text, isUser = false) {
            const now = new Date();
            const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const message = {
                id: nextId++,
                text: text,
                isUser: isUser,
                time: time
            };
            
            messages.push(message);
            renderMessages();
        },
        resetMessages: function() {
            // Clear all messages from UI
            messages = [];
            nextId = 1;
            renderMessages();
        },
        loadMessages: function(messagesArray) {
            // Load messages from external source (e.g., database history)
            messages = messagesArray.map((msg, index) => ({
                id: nextId++,
                text: msg.content || msg.text,
                isUser: msg.role === 'user' || msg.isUser,
                time: msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));
            renderMessages();
        }
    };
};

// Export for ES modules
export default ChatUI;

// Also export for UMD compatibility (if loaded via script tag)
if (typeof window !== 'undefined') {
    window.ChatUI = ChatUI;
}