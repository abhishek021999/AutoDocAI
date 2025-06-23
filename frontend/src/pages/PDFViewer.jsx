import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Button, Form, Card, Alert, Spinner, Modal, ListGroup } from 'react-bootstrap';
import axios from 'axios';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import './PDFViewer.css';
// cnd
// Set up the worker for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

const HIGHLIGHT_COLORS = {
  yellow: '#ffeb3b',
  blue: '#2196f3',
  green: '#4caf50',
  pink: '#e91e63',
  orange: '#ff9800'
};

function PDFViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pdf, setPdf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [annotation, setAnnotation] = useState('');
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfData, setPdfData] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [showHighlightModal, setShowHighlightModal] = useState(false);
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [highlightComment, setHighlightComment] = useState('');
  const [highlights, setHighlights] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [editingHighlight, setEditingHighlight] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [highlightedText, setHighlightedText] = useState(null);
  const pageRefs = useRef({});
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColors, setSelectedColors] = useState([]);
  const [filteredHighlights, setFilteredHighlights] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [annotatedPdfUrl, setAnnotatedPdfUrl] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBoxRef = useRef(null);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  // Memoize the PDF options to prevent unnecessary re-renders
  const pdfOptions = useMemo(() => ({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@2.16.105/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@2.16.105/standard_fonts/',
    withCredentials: true
  }), []);

  useEffect(() => {
    fetchPdf();
    return () => {
      if (pdfData) {
        URL.revokeObjectURL(pdfData);
      }
    };
  }, [id]);

  useEffect(() => {
    let filtered = [...highlights];

    // Filter by search query - only in comments
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(highlight => 
        highlight.comment && highlight.comment.toLowerCase().includes(query)
      );
    }

    // Filter by colors
    if (selectedColors.length > 0) {
      filtered = filtered.filter(highlight => 
        selectedColors.includes(highlight.color)
      );
    }

    setFilteredHighlights(filtered);
  }, [highlights, searchQuery, selectedColors]);

  const fetchPdf = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/pdfs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPdf(response.data);
      setHighlights(response.data.highlights || []);

      const pdfResponse = await fetch(response.data.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
        credentials: 'include'
      });

      if (!pdfResponse.ok) {
        throw new Error('Failed to fetch PDF content');
      }

      const pdfBlob = await pdfResponse.blob();
      
      if (pdfData) {
        URL.revokeObjectURL(pdfData);
      }
      
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPdfData(blobUrl);
    } catch (err) {
      console.error('Error fetching PDF:', err);
      setError('Failed to fetch PDF. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSelection = (e) => {
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
      setSelectedText(selection.toString());
      setShowHighlightModal(true);
      setIsSelecting(true);
      setSelectionStart(selection.anchorOffset);
      setSelectionEnd(selection.focusOffset);
    }
  };

  const handleAddHighlight = async () => {
    if (!selectedText.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const newHighlight = {
        text: selectedText,
        color: highlightColor,
        comment: highlightComment,
        page: pageNumber,
        start: selectionStart,
        end: selectionEnd
      };

      console.log('Adding highlight:', newHighlight);

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/highlights`,
        newHighlight,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Add highlight response:', response.data);

      // Add the new highlight to the state with the ID from the response
      setHighlights(prevHighlights => [...prevHighlights, response.data]);

      // Refresh PDF data to ensure everything is in sync
      await fetchPdf();

      setShowHighlightModal(false);
      setSelectedText('');
      setHighlightComment('');
      setHighlightColor('yellow');
      setIsSelecting(false);
    } catch (err) {
      console.error('Error adding highlight:', err);
      setError('Failed to add highlight');
    }
  };

  const handleDeleteHighlight = async (highlightId) => {
    if (!highlightId) {
      console.error('Invalid highlight ID:', highlightId);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      console.log('Deleting highlight:', highlightId);

      // Store the current highlights for potential rollback
      const previousHighlights = [...highlights];

      // First remove from state to give immediate feedback
      setHighlights(prevHighlights => prevHighlights.filter(h => h._id !== highlightId));

      const response = await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/highlights/${highlightId}`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Delete response:', response.data);

      // Verify the response
      if (!response.data || response.data.message !== 'Highlight deleted successfully') {
        throw new Error('Failed to delete highlight');
      }

      // Refresh PDF data
      await fetchPdf();

      setError('');
    } catch (err) {
      console.error('Error deleting highlight:', err);
      // Revert the state change on error
      setHighlights(previousHighlights);
      // Show error message without redirecting
      setError(err.response?.data?.message || 'Failed to delete highlight');
      
      // Show error for 3 seconds then clear it
      setTimeout(() => {
        setError('');
      }, 3000);
    }
  };

  const handleAddAnnotation = async () => {
    if (!annotation.trim()) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/annotations`,
        {
          text: annotation,
          page: pageNumber
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAnnotation('');
      fetchPdf();
    } catch (err) {
      console.error('Error adding annotation:', err);
      setError('Failed to add annotation');
    }
  };

  const handleDeleteAnnotation = async (annotationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/annotations/${annotationId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      fetchPdf();
    } catch (err) {
      console.error('Error deleting annotation:', err);
      setError('Failed to delete annotation');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPdfLoading(false);
  };

  const onDocumentLoadError = (error) => {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF. Please try refreshing the page.');
    setPdfLoading(false);
  };

  const handleEditHighlight = (highlight) => {
    if (!highlight || !highlight._id) {
      console.error('Invalid highlight object:', highlight);
      return;
    }
    console.log('Editing highlight:', highlight);
    setEditingHighlight(highlight);
    setHighlightColor(highlight.color || 'yellow');
    setHighlightComment(highlight.comment || '');
    setShowEditModal(true);
    // Prevent the highlight navigation
    setHighlightedText(null);
  };

  const handleUpdateHighlight = async () => {
    if (!editingHighlight || !editingHighlight._id) {
      console.error('Invalid editing highlight:', editingHighlight);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const updatedHighlight = {
        color: highlightColor,
        comment: highlightComment
      };

      console.log('Updating highlight:', {
        id: editingHighlight._id,
        data: updatedHighlight
      });

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/highlights/${editingHighlight._id}`,
        updatedHighlight,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Update response:', response.data);

      // Update the highlights array with the new data
      setHighlights(prevHighlights => 
        prevHighlights.map(h => 
          h._id === editingHighlight._id ? { ...h, ...response.data } : h
        )
      );

      // Refresh PDF data
      await fetchPdf();

      setShowEditModal(false);
      setEditingHighlight(null);
      setHighlightComment('');
      setHighlightColor('yellow');
    } catch (err) {
      console.error('Error updating highlight:', err);
      setError('Failed to update highlight');
    }
  };

  const navigateToHighlight = (highlight) => {
    console.log('Navigating to highlight:', highlight);
    
    // First set the page number
    setPageNumber(highlight.page);
    setHighlightedText(highlight);

    // Wait for the page to render
    setTimeout(() => {
      try {
        // Get the page element
        const pageElement = pageRefs.current[highlight.page];
        if (!pageElement) {
          console.error('Page element not found');
          return;
        }

        // Get the text layer
        const textLayer = pageElement.querySelector('.react-pdf__Page__textContent');
        if (!textLayer) {
          console.error('Text layer not found');
          return;
        }

        // Get all text spans
        const textSpans = Array.from(textLayer.querySelectorAll('span'));
        console.log('Total spans found:', textSpans.length);

        // Find the matching text
        const highlightText = highlight.text.trim().toLowerCase();
        let targetSpans = [];
        let bestMatch = null;
        let bestMatchScore = 0;

        // First pass: Find the best matching span
        textSpans.forEach(span => {
          const spanText = span.textContent.trim().toLowerCase();
          if (spanText === highlightText) {
            // Exact match
            bestMatch = span;
            bestMatchScore = 1;
          } else if (spanText.includes(highlightText)) {
            // Partial match - store for potential use if no exact match is found
            const matchScore = highlightText.length / spanText.length;
            if (matchScore > bestMatchScore) {
              bestMatch = span;
              bestMatchScore = matchScore;
            }
          }
        });

        // If we found a match, get all spans that are part of the same text block
        if (bestMatch) {
          const bestMatchRect = bestMatch.getBoundingClientRect();
          const bestMatchTop = bestMatchRect.top;
          const bestMatchBottom = bestMatchRect.bottom;
          const tolerance = 5; // pixels tolerance for considering spans on the same line

          textSpans.forEach(span => {
            const spanRect = span.getBoundingClientRect();
            // Check if span is on the same line as the best match
            if (Math.abs(spanRect.top - bestMatchTop) <= tolerance && 
                Math.abs(spanRect.bottom - bestMatchBottom) <= tolerance) {
              targetSpans.push(span);
            }
          });
        }

        console.log('Found matching spans:', targetSpans.length);

        // Get the scroll container
        const scrollContainer = document.querySelector('.col[style*="overflow: auto"]');
        if (!scrollContainer) {
          console.error('Scroll container not found');
          return;
        }

        // Get the page dimensions
        const pageRect = pageElement.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();

        // Calculate the position based on the actual text position
        let scrollTop;
        if (bestMatch) {
          const bestMatchRect = bestMatch.getBoundingClientRect();
          scrollTop = scrollContainer.scrollTop + 
            (bestMatchRect.top - containerRect.top) - 
            (containerRect.height / 2) + 
            (bestMatchRect.height / 2);
        } else {
          // Fallback to percentage-based position if no exact match found
          const pageHeight = pageRect.height;
          const highlightPosition = (highlight.start / 100) * pageHeight;
          scrollTop = scrollContainer.scrollTop + 
            (pageRect.top - containerRect.top) + 
            highlightPosition - 
            (containerRect.height / 2);
        }

        // Ensure we don't scroll beyond the document boundaries
        const maxScroll = scrollContainer.scrollHeight - containerRect.height;
        scrollTop = Math.max(0, Math.min(scrollTop, maxScroll));

        // Ensure the page is fully rendered before scrolling
        const checkPageRendered = () => {
          if (pageElement.offsetHeight > 0) {
            // Page is rendered, now scroll
            scrollContainer.scrollTo({
              top: scrollTop,
              behavior: 'smooth'
            });

            // If we found matching spans, highlight them
            if (targetSpans.length > 0) {
              // Store original styles for each span
              const originalStyles = targetSpans.map(span => ({
                backgroundColor: span.style.backgroundColor,
                color: span.style.color,
                transition: span.style.transition
              }));

              // Apply highlight styles to all matching spans
              targetSpans.forEach(span => {
                span.style.backgroundColor = HIGHLIGHT_COLORS[highlight.color];
                span.style.color = '#000000';
                span.style.transition = 'all 0.5s ease-in-out';
              });

              // Remove highlight after 5 seconds
              setTimeout(() => {
                targetSpans.forEach((span, index) => {
                  const original = originalStyles[index];
                  span.style.backgroundColor = original.backgroundColor;
                  span.style.color = original.color;
                  span.style.transition = original.transition;
                });
              }, 5000);
            }
          } else {
            // Page not yet rendered, check again after a short delay
            setTimeout(checkPageRendered, 100);
          }
        };

        // Start checking if the page is rendered
        checkPageRendered();

      } catch (error) {
        console.error('Error during navigation:', error);
      }
    }, 500);
  };

  const handleGenerateAnnotated = async () => {
    try {
      setGenerating(true);
      setError('');
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/generate-annotated`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAnnotatedPdfUrl(response.data.url);

      // Fetch the annotated PDF
      const pdfResponse = await fetch(response.data.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
        credentials: 'include'
      });

      if (!pdfResponse.ok) {
        throw new Error('Failed to fetch annotated PDF content');
      }

      const pdfBlob = await pdfResponse.blob();
      
      if (pdfData) {
        URL.revokeObjectURL(pdfData);
      }
      
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPdfData(blobUrl);
    } catch (err) {
      console.error('Error generating annotated PDF:', err);
      setError('Failed to generate annotated PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError('');
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/pdfs/${id}/export`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${pdf.title.replace('.pdf', '')}_annotated.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const toggleColorFilter = (color) => {
    setSelectedColors(prev => 
      prev.includes(color)
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setStartPanPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const deltaX = e.clientX - startPanPosition.x;
      const deltaY = e.clientY - startPanPosition.y;
      setPanPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setStartPanPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const renderSidebar = () => {
    return (
      <div 
        className="sidebar" 
        style={{ 
          height: '100%',
          overflowY: 'auto',
          borderRight: '1px solid #dee2e6',
          boxShadow: '2px 0 5px rgba(0,0,0,0.05)',
          transition: 'all 0.3s ease',
          width: isSidebarCollapsed ? '50px' : '300px',
          position: 'relative'
        }}
      >
        <Button
          variant="light"
          className="position-absolute"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          style={{ 
            zIndex: 1000,
            right: '8px',
            top: '20px',
            width: '20px',
            height: '20px',
            padding: 0,
            borderRadius: '50%',
            border: '1px solid #dee2e6',
            backgroundColor: 'white',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.7,
            transition: 'opacity 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
        >
          <i className={`bi bi-chevron-${isSidebarCollapsed ? 'right' : 'left'}`} style={{ fontSize: '0.7rem' }}></i>
        </Button>

        <div className="p-3" style={{ display: isSidebarCollapsed ? 'none' : 'block' }}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h4 className="mb-0">Highlights & Notes</h4>
          </div>

          {/* Search Bar */}
          <div className="mb-3 position-relative">
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-chat-left-text text-muted"></i>
              </span>
              <Form.Control
                type="text"
                placeholder="Search by comments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-0"
              />
              {searchQuery && (
                <span 
                  className="input-group-text"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSearchQuery('')}
                >
                  <i className="bi bi-x text-muted"></i>
                </span>
              )}
            </div>
            <div 
              className="position-absolute w-100 mt-1" 
              style={{ 
                zIndex: 1000,
                display: searchQuery ? 'block' : 'none'
              }}
            >
              <div className="bg-white rounded shadow-sm p-2">
                <small className="text-muted">
                  {filteredHighlights.length} results found
                </small>
              </div>
            </div>
          </div>

          {/* Color Filters */}
          <div className="mb-3">
            <small className="text-muted d-block mb-2">Filter by color:</small>
            <div className="d-flex flex-column gap-2">
              {Object.entries(HIGHLIGHT_COLORS).map(([name, color]) => (
                <Form.Check
                  key={name}
                  type="checkbox"
                  id={`color-${name}`}
                  className="color-filter-checkbox"
                  label={
                    <div className="d-flex align-items-center">
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          backgroundColor: color,
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          marginRight: '8px'
                        }}
                      />
                      <span style={{ textTransform: 'capitalize' }}>{name}</span>
                    </div>
                  }
                  checked={selectedColors.includes(name)}
                  onChange={() => toggleColorFilter(name)}
                />
              ))}
            </div>
          </div>

          {/* Results count */}
          <div className="mb-3">
            <small className="text-muted">
              {filteredHighlights.length} of {highlights.length} highlights shown
            </small>
          </div>

          {filteredHighlights.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-search display-4"></i>
              <p className="mt-3">
                {highlights.length === 0 
                  ? "No highlights yet"
                  : "No highlights match your search"}
              </p>
              <small>
                {highlights.length === 0 
                  ? "Select text in the PDF to add highlights"
                  : "Try adjusting your search or filters"}
              </small>
            </div>
          ) : (
            <ListGroup>
              {filteredHighlights.map((highlight, index) => (
                <ListGroup.Item 
                  key={highlight._id || index}
                  className="mb-3 p-3"
                  style={{ 
                    borderLeft: `4px solid ${HIGHLIGHT_COLORS[highlight.color]}`,
                    cursor: 'pointer',
                    borderRadius: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    backgroundColor: pageNumber === highlight.page ? '#f8f9fa' : 'white'
                  }}
                  onClick={(e) => {
                    if (!e.target.closest('.btn')) {
                      navigateToHighlight(highlight);
                    }
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center mb-2">
                        <span 
                          className="badge rounded-pill me-2"
                          style={{ 
                            backgroundColor: HIGHLIGHT_COLORS[highlight.color],
                            color: '#000'
                          }}
                        >
                          Page {highlight.page}
                        </span>
                        <small className="text-muted">
                          {new Date(highlight.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                      
                      <div 
                        className="highlight-text mb-2 p-2 rounded"
                        data-color={highlight.color}
                        style={{
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '150px',
                          overflowY: 'auto',
                          backgroundColor: `${HIGHLIGHT_COLORS[highlight.color]}40`,
                          fontSize: '0.9rem',
                          borderLeft: `4px solid ${HIGHLIGHT_COLORS[highlight.color]}`
                        }}
                      >
                        {highlight.text}
                      </div>

                      {highlight.comment && (
                        <div 
                          className="highlight-comment mt-2 p-2 rounded"
                          style={{
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '100px',
                            overflowY: 'auto',
                            backgroundColor: `${HIGHLIGHT_COLORS[highlight.color]}20`,
                            fontSize: '0.9rem',
                            borderLeft: `4px solid ${HIGHLIGHT_COLORS[highlight.color]}`
                          }}
                        >
                          <small className="text-muted d-block mb-1">
                            <i className="bi bi-chat-left-text me-1"></i>
                            Comment
                          </small>
                          <p className="mb-0">{highlight.comment}</p>
                        </div>
                      )}
                    </div>

                    <div className="ms-2 d-flex flex-column">
                      <Button
                        variant="link"
                        size="sm"
                        className="text-primary p-0 mb-1"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Edit button clicked for highlight:', highlight);
                          setEditingHighlight(highlight);
                          setHighlightColor(highlight.color || 'yellow');
                          setHighlightComment(highlight.comment || '');
                          setShowEditModal(true);
                        }}
                        title="Edit highlight"
                      >
                        <i className="bi bi-pencil"></i>
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-danger p-0"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteHighlight(highlight._id);
                        }}
                        title="Delete highlight"
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </div>

        {isSidebarCollapsed && (
          <div className="d-flex justify-content-center align-items-center h-100">
            <i className="bi bi-highlighter display-6 text-primary"></i>
          </div>
        )}
      </div>
    );
  };

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !pdf) return;
    const userMessage = chatInput.trim();
    setChatMessages((msgs) => [...msgs, { sender: 'user', text: userMessage }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/chatbot`,
        { userMessage, pdfId: pdf._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setChatMessages((msgs) => [...msgs, { sender: 'bot', text: response.data.botReply }]);
    } catch (err) {
      setChatMessages((msgs) => [...msgs, { sender: 'bot', text: 'Sorry, there was an error.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <Container>
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert variant="danger" className="mt-4">
          {error}
          <div className="mt-3">
            <Button variant="outline-primary" onClick={() => navigate('/library')}>
              Back to Library
            </Button>
          </div>
        </Alert>
      </Container>
    );
  }

  if (!pdf) {
    return (
      <Container>
        <Alert variant="warning" className="mt-4">
          PDF not found
          <div className="mt-3">
            <Button variant="outline-primary" onClick={() => navigate('/library')}>
              Back to Library
            </Button>
          </div>
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="pdf-container">
      <Row className="g-0 h-100" style={{ 
        overflow: 'hidden'
      }}>
        <Col style={{ 
          width: isSidebarCollapsed ? '50px' : '300px',
          transition: 'all 0.3s ease',
          flex: '0 0 auto',
          height: '100%',
          position: 'fixed',
          left: 0,
          top: '56px',
          zIndex: 2,
          backgroundColor: 'white',
          borderRight: '1px solid #dee2e6',
          overflowY: 'auto'
        }}>
          {renderSidebar()}
        </Col>
        <Col style={{ 
          transition: 'all 0.3s ease',
          flex: '1 1 auto',
          width: isSidebarCollapsed ? 'calc(100% - 50px)' : 'calc(100% - 300px)',
          marginLeft: isSidebarCollapsed ? '50px' : '300px',
          height: '100%',
          overflow: 'auto',
          backgroundColor: '#f8f9fa',
          position: 'fixed',
          top: '56px',
          right: 0,
          zIndex: 2
        }}>
          <div className="pdf-container p-3">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              </div>
            ) : error ? (
              <Alert variant="danger">{error}</Alert>
            ) : (
              <div className="pdf-viewer" style={{ marginBottom: '100px' }}>
                <div className="pdf-controls bg-white py-2" style={{ 
                  zIndex: 1030,
                  borderBottom: '1px solid #dee2e6',
                  position: 'fixed',
                  top: '56px',
                  left: isSidebarCollapsed ? '50px' : '300px',
                  right: 0,
                  padding: '0.5rem 1rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => setPageNumber(page => Math.max(1, page - 1))}
                        disabled={pageNumber <= 1}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </Button>
                      <span className="mx-3">
                        Page {pageNumber} of {numPages}
                      </span>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => setPageNumber(page => Math.min(numPages, page + 1))}
                        disabled={pageNumber >= numPages}
                      >
                        <i className="bi bi-chevron-right"></i>
                      </Button>
                    </div>
                    <div className="d-flex align-items-center">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                      >
                        <i className="bi bi-zoom-out"></i>
                      </Button>
                      <span className="mx-2">{Math.round(scale * 100)}%</span>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setScale(s => Math.min(2, s + 0.1))}
                      >
                        <i className="bi bi-zoom-in"></i>
                      </Button>
                      <div className="ms-3 d-flex gap-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={handleGenerateAnnotated}
                          disabled={generating}
                        >
                          {generating ? (
                            <>
                              <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                                className="me-2"
                              />
                              Generating...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-file-earmark-text me-2"></i>
                              Generate Annotated PDF
                            </>
                          )}
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleExport}
                          disabled={exporting || !annotatedPdfUrl}
                        >
                          {exporting ? (
                            <>
                              <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                                className="me-2"
                              />
                              Exporting...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-download me-2"></i>
                              Download PDF
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div 
                  className="pdf-document mt-4"
                  onMouseUp={handleTextSelection}
                >
                  <Document
                    file={pdfData}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    options={pdfOptions}
                    loading={
                      <div className="text-center py-5">
                        <Spinner animation="border" role="status">
                          <span className="visually-hidden">Loading PDF...</span>
                        </Spinner>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      inputRef={el => {
                        if (el) {
                          pageRefs.current[pageNumber] = el;
                        }
                      }}
                      onRenderSuccess={() => {
                        console.log('Page rendered successfully:', pageNumber);
                      }}
                      onRenderError={(error) => {
                        console.error('Error rendering page:', error);
                      }}
                    />
                  </Document>
                </div>
              </div>
            )}
          </div>
        </Col>
      </Row>

      {/* Highlight Modal */}
      <Modal show={showHighlightModal} onHide={() => setShowHighlightModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Highlight</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Selected Text</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={selectedText}
                readOnly
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Color</Form.Label>
              <div className="d-flex gap-2">
                {Object.entries(HIGHLIGHT_COLORS).map(([name, color]) => (
                  <Button
                    key={name}
                    variant="outline-secondary"
                    style={{
                      backgroundColor: highlightColor === name ? color : 'transparent',
                      borderColor: color,
                      width: '40px',
                      height: '40px'
                    }}
                    onClick={() => setHighlightColor(name)}
                  />
                ))}
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Comment (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={highlightComment}
                onChange={(e) => setHighlightComment(e.target.value)}
                placeholder="Add a comment to your highlight..."
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHighlightModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddHighlight}>
            Add Highlight
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Highlight Modal */}
      <Modal show={showEditModal} onHide={() => {
        setShowEditModal(false);
        setEditingHighlight(null);
        setHighlightComment('');
        setHighlightColor('yellow');
      }}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Highlight</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Selected Text</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={editingHighlight?.text || ''}
                readOnly
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Color</Form.Label>
              <div className="d-flex gap-2">
                {Object.entries(HIGHLIGHT_COLORS).map(([name, color]) => (
                  <Button
                    key={name}
                    variant="outline-secondary"
                    style={{
                      backgroundColor: highlightColor === name ? color : 'transparent',
                      borderColor: color,
                      width: '40px',
                      height: '40px'
                    }}
                    onClick={() => setHighlightColor(name)}
                  />
                ))}
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Comment</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={highlightComment}
                onChange={(e) => setHighlightComment(e.target.value)}
                placeholder="Add a comment to your highlight..."
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowEditModal(false);
            setEditingHighlight(null);
            setHighlightComment('');
            setHighlightColor('yellow');
          }}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdateHighlight}>
            Update Highlight
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Chatbot UI */}
      <div 
        className="chatbot-container" 
        style={{ 
          position: 'fixed', 
          right: 30, 
          bottom: isChatMinimized ? -360 : 30, 
          width: 380,
          height: 400,
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          transition: 'bottom 0.3s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Chat Header */}
        <div 
          style={{ 
            padding: '15px 20px',
            borderBottom: '1px solid rgba(0,0,0,0.1)',
            background: '#2196f3',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer'
          }}
          onClick={() => setIsChatMinimized(!isChatMinimized)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="bi bi-chat-dots" style={{ fontSize: '1.2rem' }}></i>
            <span style={{ fontWeight: '600' }}>PDF Assistant</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {chatLoading && <div className="spinner-border spinner-border-sm text-light" role="status" />}
            <i className={`bi bi-chevron-${isChatMinimized ? 'up' : 'down'}`}></i>
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          ref={chatBoxRef} 
          style={{ 
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            background: '#f8f9fa',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {chatMessages.length === 0 && (
            <div style={{ 
              color: '#666',
              textAlign: 'center',
              padding: '20px',
              background: '#fff',
              borderRadius: '8px',
              border: '1px dashed #ddd',
              margin: '10px 0'
            }}>
              <i className="bi bi-robot" style={{ fontSize: '2rem', color: '#2196f3', marginBottom: '10px', display: 'block' }}></i>
              <div>Hi! I'm your PDF Assistant.</div>
              <div style={{ fontSize: '0.9em', color: '#888' }}>Ask me anything about this document!</div>
            </div>
          )}

          {chatMessages.map((msg, idx) => (
            <div 
              key={idx} 
              style={{ 
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              <div style={{
                background: msg.sender === 'user' ? '#2196f3' : '#fff',
                color: msg.sender === 'user' ? '#fff' : '#333',
                padding: '12px 16px',
                borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                fontSize: '0.95rem',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#888',
                marginTop: '4px',
                textAlign: msg.sender === 'user' ? 'right' : 'left'
              }}>
                {msg.sender === 'user' ? 'You' : 'Assistant'}
              </div>
            </div>
          ))}
          
          {chatLoading && (
            <div style={{ alignSelf: 'flex-start', padding: '8px 0' }}>
              <div style={{
                background: '#e9ecef',
                padding: '8px 16px',
                borderRadius: '16px',
                display: 'inline-flex',
                gap: '4px'
              }}>
                <span className="typing-dot">•</span>
                <span className="typing-dot">•</span>
                <span className="typing-dot">•</span>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div style={{ 
          borderTop: '1px solid rgba(0,0,0,0.1)',
          padding: '15px',
          background: '#fff',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end'
        }}>
          <textarea
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleChatInputKeyDown}
            rows={1}
            style={{ 
              flex: 1,
              resize: 'none',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.95rem',
              lineHeight: '1.4',
              maxHeight: '120px',
              minHeight: '40px',
              outline: 'none',
              transition: 'border-color 0.2s',
              ':focus': {
                borderColor: '#2196f3'
              }
            }}
            placeholder="Type your question..."
            disabled={chatLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={chatLoading || !chatInput.trim()}
            style={{ 
              padding: '8px 16px',
              border: 'none',
              background: chatLoading || !chatInput.trim() ? '#e9ecef' : '#2196f3',
              color: chatLoading || !chatInput.trim() ? '#666' : '#fff',
              borderRadius: '8px',
              fontWeight: '500',
              cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="bi bi-send"></i>
            Send
          </button>
        </div>
      </div>

      {/* Add CSS for animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .typing-dot {
            animation: blink 1.4s infinite;
            font-size: 20px;
            line-height: 20px;
          }
          
          .typing-dot:nth-child(2) { animation-delay: .2s; }
          .typing-dot:nth-child(3) { animation-delay: .4s; }
          
          @keyframes blink {
            50% { opacity: 0.2; }
          }
          
          .chatbot-container textarea:focus {
            border-color: #2196f3 !important;
            box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.15);
          }
        `}
      </style>
    </Container>
  );
}

export default PDFViewer; 