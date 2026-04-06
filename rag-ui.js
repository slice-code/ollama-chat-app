import './el.js';

export default function RagUI(config = {}) {
  const container = config.container || document.body;
  let documents = [];
  let currentEditId = null;

  // Create main RAG container
  const ragContainer = el('div')
    .id('rag-container')
    .css({
      'display': 'flex',
      'flex-direction': 'column',
      'height': '100%',
      'width': '100%',
      'background': '#f5f5f5',
      'font-family': 'system-ui, -apple-system, sans-serif',
      'color': '#333'
    });

  // Header
  const header = el('div')
    .css({
      'background': '#075E54',
      'color': 'white',
      'padding': '20px',
      'text-align': 'center',
      'border-bottom': '3px solid #054942',
      'position': 'relative'
    })
    .html(`
      <h1 style="margin: 0; font-size: 24px;">📚 RAG - Knowledge Base</h1>
      <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">Manage your documents for AI context</p>
    `);

  // Back to chat button
  const backButton = el('button')
    .text('← Back to Chat')
    .css({
      'position': 'absolute',
      'top': '10px',
      'right': '10px',
      'padding': '8px 16px',
      'background': '#fff',
      'color': '#075E54',
      'border': 'none',
      'border-radius': '4px',
      'cursor': 'pointer',
      'font-weight': 'bold',
      'font-size': '12px'
    })
    .click(() => {
      console.log('🔙 Back to Chat button clicked, calling onBack...');
      if (config.onBack && typeof config.onBack === 'function') {
        config.onBack();
      } else {
        console.warn('⚠️ No onBack callback provided');
      }
    });

  header.child(backButton);
  header.get(); // Render backButton to header

  // Main content area - with proper flexbox layout
  const contentArea = el('div')
    .css({
      'display': 'flex',
      'flex-direction': 'row',
      'gap': '20px',
      'padding': '20px',
      'overflow-y': 'auto',
      'min-height': '0',
      'flex': '1'
    });

  // Left panel - Add document form
  const leftPanel = el('div')
    .css({
      'background': 'white',
      'padding': '20px',
      'border-radius': '8px',
      'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
      'flex': '1',
      'min-width': '300px',
      'overflow-y': 'auto',
      'max-height': '100%'
    });

  const formTitle = el('h2')
    .text('Add New Document')
    .css({
      'margin': '0 0 20px 0',
      'color': '#075E54',
      'font-size': '18px'
    });

  const titleLabel = el('label')
    .text('Document Title')
    .css({
      'display': 'block',
      'margin-bottom': '8px',
      'font-weight': 'bold',
      'font-size': '12px'
    });

  const titleInput = el('input')
    .attr('type', 'text')
    .attr('placeholder', 'e.g., Company Policies, Product Guide')
    .css({
      'width': '100%',
      'padding': '10px',
      'margin-bottom': '15px',
      'border': '1px solid #ddd',
      'border-radius': '4px',
      'font-size': '13px',
      'box-sizing': 'border-box'
    });

  const contentLabel = el('label')
    .text('Document Content')
    .css({
      'display': 'block',
      'margin-bottom': '8px',
      'font-weight': 'bold',
      'font-size': '12px'
    });

  const contentInput = el('textarea')
    .attr('placeholder', 'Paste your document text here...')
    .css({
      'width': '100%',
      'padding': '10px',
      'margin-bottom': '15px',
      'border': '1px solid #ddd',
      'border-radius': '4px',
      'font-size': '13px',
      'min-height': '200px',
      'resize': 'vertical',
      'box-sizing': 'border-box',
      'font-family': 'monospace'
    });

  const submitButton = el('button')
    .text('➕ Add Document')
    .css({
      'width': '100%',
      'padding': '12px',
      'background': '#075E54',
      'color': 'white',
      'border': 'none',
      'border-radius': '4px',
      'cursor': 'pointer',
      'font-weight': 'bold',
      'font-size': '14px',
      'transition': 'all 0.2s'
    })
    .hover(
      function() { this.style.background = '#054942'; },
      function() { this.style.background = '#075E54'; }
    )
    .click(async () => {
      const title = titleInput.el.value.trim();
      const content = contentInput.el.value.trim();

      if (!title) {
        alert('Please enter a document title');
        return;
      }

      if (!content) {
        alert('Please enter document content');
        return;
      }

      try {
        const payload = { title, content };
        
        if (currentEditId) {
          // Update existing document
          const response = await fetch(`/api/rag/documents/${currentEditId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update document');
          }

          console.log('✓ Document updated');
          currentEditId = null;
          submitButton.text('➕ Add Document');
          submitButton.el.style.background = '#075E54'; // Reset button color
        } else {
          // Add new document
          const response = await fetch('/api/rag/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add document');
          }

          console.log('✓ Document added');
        }

        titleInput.el.value = '';
        contentInput.el.value = '';
        await loadDocuments();
      } catch (err) {
        console.error('❌ Error:', err);
        alert('Error: ' + err.message);
      }
    });

  leftPanel.child([formTitle, titleLabel, titleInput, contentLabel, contentInput, submitButton]);
  leftPanel.get(); // IMPORTANT: Render children to leftPanel

  // Right panel - Documents list
  const rightPanel = el('div')
    .css({
      'background': 'white',
      'padding': '20px',
      'border-radius': '8px',
      'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
      'display': 'flex',
      'flex-direction': 'column',
      'flex': '1',
      'min-width': '300px',
      'overflow': 'hidden'
    });

  const listTitle = el('h2')
    .text('Your Documents')
    .css({
      'margin': '0 0 15px 0',
      'color': '#075E54',
      'font-size': '18px',
      'display': 'flex',
      'justify-content': 'space-between',
      'align-items': 'center'
    });

  const docCount = el('span')
    .css({
      'background': '#075E54',
      'color': 'white',
      'padding': '4px 8px',
      'border-radius': '4px',
      'font-size': '12px',
      'font-weight': 'normal'
    });

  listTitle.child(docCount);
  listTitle.get(); // Render count badge to title

  const documentsList = el('div')
    .css({
      'flex': '1',
      'overflow': 'auto',
      'display': 'flex',
      'flex-direction': 'column',
      'gap': '10px'
    });

  rightPanel.child([listTitle, documentsList]);
  rightPanel.get(); // IMPORTANT: Render children to rightPanel

  // Function to load documents
  async function loadDocuments() {
    try {
      const response = await fetch('/api/rag/documents');
      const data = await response.json();

      if (!data.success) throw new Error(data.error);

      documents = data.documents || [];
      docCount.text(`${documents.length}`);

      // Clear the documentsList completely - remove all children
      documentsList.el.innerHTML = '';
      documentsList.ch = []; // Clear queued children too

      if (documents.length === 0) {
        const emptyMsg = el('div')
          .css({
            'padding': '20px',
            'text-align': 'center',
            'color': '#999',
            'font-style': 'italic'
          })
          .text('No documents yet. Add one to get started!');
        documentsList.child(emptyMsg);
        documentsList.get(); // Render empty message
      } else {
        documents.forEach(doc => {
          const docItem = el('div')
            .css({
              'padding': '12px',
              'background': '#f9f9f9',
              'border': '1px solid #e0e0e0',
              'border-radius': '4px',
              'display': 'flex',
              'justify-content': 'space-between',
              'align-items': 'center',
              'gap': '10px'
            });

          const docInfo = el('div')
            .css({
              'flex': '1',
              'min-width': '0'
            });

          const docTitle = el('div')
            .text(doc.title)
            .css({
              'font-weight': 'bold',
              'font-size': '13px',
              'white-space': 'nowrap',
              'overflow': 'hidden',
              'text-overflow': 'ellipsis'
            });

          const docDate = el('div')
            .text(new Date(doc.created_at).toLocaleString())
            .css({
              'font-size': '11px',
              'color': '#999',
              'margin-top': '4px'
            });

          docInfo.child([docTitle, docDate]);
          docInfo.get(); // Render title + date to docInfo

          const actions = el('div')
            .css({
              'display': 'flex',
              'gap': '6px'
            });

          const editBtn = el('button')
            .text('✎')
            .css({
              'padding': '6px 10px',
              'background': '#4CAF50',
              'color': 'white',
              'border': 'none',
              'border-radius': '4px',
              'cursor': 'pointer',
              'font-size': '12px'
            })
            .click(async () => {
              try {
                const response = await fetch(`/api/rag/documents/${doc.id}`);
                const data = await response.json();
                if (data.success) {
                  currentEditId = doc.id;
                  titleInput.el.value = data.document.title;
                  contentInput.el.value = data.document.content;
                  submitButton.text('💾 Update Document');
                  submitButton.el.style.background = '#FF6B00'; // Orange for edit mode
                  titleInput.el.focus();
                  window.scrollTo(0, 0);
                }
              } catch (err) {
                alert('Error loading document: ' + err.message);
              }
            });

          const deleteBtn = el('button')
            .text('🗑️')
            .css({
              'padding': '6px 10px',
              'background': '#f44336',
              'color': 'white',
              'border': 'none',
              'border-radius': '4px',
              'cursor': 'pointer',
              'font-size': '12px'
            })
            .click(async () => {
              if (confirm(`Delete "${doc.title}"?`)) {
                try {
                  const response = await fetch(`/api/rag/documents/${doc.id}`, {
                    method: 'DELETE'
                  });
                  if (response.ok) {
                    console.log('✓ Document deleted');
                    await loadDocuments();
                  }
                } catch (err) {
                  alert('Error deleting document: ' + err.message);
                }
              }
            });

          actions.child([editBtn, deleteBtn]);
          actions.get(); // Render edit + delete buttons to actions
          
          docItem.child([docInfo, actions]);
          docItem.get(); // Render info + actions to docItem
          
          documentsList.child(docItem);
        });
        documentsList.get(); // Render all document items
      }
    } catch (err) {
      console.error('❌ Error loading documents:', err);
      documentsList.el.innerHTML = '';
      const errorMsg = el('div')
        .css({
          'padding': '20px',
          'color': '#f44336',
          'text-align': 'center'
        })
        .text('Error loading documents: ' + err.message);
      documentsList.child(errorMsg);
      documentsList.get(); // Render error message
    }
  }

  // Add responsive CSS
  const styleEl = el('style')
    .html(`
      #rag-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      #rag-wrapper {
        width: 100% !important;
        height: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }

      @media (max-width: 768px) {
        #rag-container > div:nth-child(2) {
          flex-direction: column !important;
          padding: 10px !important;
          gap: 10px !important;
        }
      }
    `);
  
  document.head.appendChild(styleEl.get());

  // Initialization - proper order with .get() calls
  // First add content to contentArea, then header to ragContainer
  contentArea.child([leftPanel, rightPanel]);
  contentArea.get(); // Render children to contentArea
  
  ragContainer.child([header, contentArea]);
  container.appendChild(ragContainer.get()); // Final render and append to DOM

  // Load documents on startup
  loadDocuments();

  return {
    element: ragContainer.el,
    refresh: loadDocuments
  };
}
