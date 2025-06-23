import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Form, Badge, InputGroup } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
// ssdj
function UserLibrary() {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('uploadDate');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchPdfs();
  }, []);

  const fetchPdfs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/pdfs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPdfs(response.data);
    } catch (err) {
      toast.error('Failed to fetch PDFs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const pdfToDelete = pdfs.find(pdf => pdf._id === id);
    if (!pdfToDelete) return;

    toast.info(
      <div>
        <p>Are you sure you want to delete "{pdfToDelete.title}"?</p>
        <div className="d-flex justify-content-end gap-2 mt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.dismiss()}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              toast.dismiss();
              try {
                const token = localStorage.getItem('token');
                await axios.delete(`${import.meta.env.VITE_API_URL}/api/pdfs/${id}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                toast.success(`"${pdfToDelete.title}" has been deleted successfully`);
                fetchPdfs();
              } catch (err) {
                toast.error('Failed to delete PDF');
              }
            }}
          >
            Delete
          </Button>
        </div>
      </div>,
      {
        position: "top-center",
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        closeButton: false
      }
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const filteredAndSortedPdfs = pdfs
    .filter(pdf => 
      pdf.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'uploadDate':
          comparison = new Date(a.uploadDate) - new Date(b.uploadDate);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  if (loading) {
    return (
      <Container>
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      <Row className="mb-4">
        <Col>
          <h2 className="mb-4">My Library</h2>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search PDFs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={3}>
              <Form.Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="uploadDate">Sort by Date</option>
                <option value="title">Sort by Title</option>
                <option value="size">Sort by Size</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Button
                variant="outline-secondary"
                className="w-100"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <i className={`bi bi-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row>
        {filteredAndSortedPdfs.map((pdf) => (
          <Col key={pdf._id} md={4} className="mb-4">
            <Card className="h-100 shadow-sm">
              <Card.Body>
                <div className="text-center mb-3">
                  <div className="pdf-thumbnail mb-3">
                    <i className="bi bi-file-pdf text-danger" style={{ fontSize: '3rem' }}></i>
                  </div>
                  <Card.Title className="text-truncate">{pdf.title}</Card.Title>
                </div>
                <Card.Text>
                  <small className="text-muted d-block mb-2">
                    Uploaded: {formatDate(pdf.createdAt)}
                  </small>
                  <div className="d-flex gap-2 mb-2">
                    <Badge bg="info">
                      {formatFileSize(pdf.size)}
                    </Badge>
                  </div>
                </Card.Text>
                {pdf.summary && (
                  <div>
                    <h6 className="mt-3">Summary</h6>
                    <Card.Text style={{ fontSize: '0.8rem', 'white-space': 'pre-line' }}>
                      {pdf.summary}
                    </Card.Text>
                  </div>
                )}
                <div className="d-flex gap-2 mt-3">
                  <Button
                    as={Link}
                    to={`/pdf/${pdf._id}`}
                    variant="primary"
                    size="sm"
                    className="flex-grow-1"
                  >
                    <i className="bi bi-eye me-1"></i>
                    View
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(pdf._id)}
                  >
                    <i className="bi bi-trash me-1"></i>
                    Delete
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {filteredAndSortedPdfs.length === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-file-earmark-pdf text-primary" style={{ fontSize: '3rem' }}></i>
          <h4 className="mt-3">
            {searchTerm ? 'No matching PDFs found' : 'Your library is empty'}
          </h4>
          <p className="mb-0">
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Upload your first PDF from the dashboard'}
          </p>
          {!searchTerm && (
            <Button
              as={Link}
              to="/dashboard"
              variant="primary"
              className="mt-3"
            >
              Go to Dashboard
            </Button>
          )}
        </div>
      )}
    </Container>
  );
}

export default UserLibrary; 