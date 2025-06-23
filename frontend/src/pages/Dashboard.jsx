import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Form, Badge } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';

function Dashboard() {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchPdfs();
  }, []);

  const fetchPdfs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/pdfs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sortedPdfs = response.data.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      setPdfs(sortedPdfs.slice(0, 1));
    } catch (err) {
      console.error('Error fetching PDFs:', err);
      toast.error('Failed to fetch PDFs. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        setSelectedFile(null);
        e.target.value = null;
        return;
      }
      setSelectedFile(file);
    } else {
      toast.error('Please select a valid PDF file');
      setSelectedFile(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('pdf', selectedFile);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL}/api/pdfs/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      setSelectedFile(null);
      e.target.reset();
      toast.success('PDF uploaded successfully');
      
      // Add a small delay before fetching PDFs to allow backend processing
      setTimeout(() => {
        fetchPdfs();
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload PDF');
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
          <h2 className="mb-4">Recent Upload</h2>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Body>
          <Form onSubmit={handleUpload}>
            <div className="d-flex gap-3">
              <div className="flex-grow-1">
                <Form.Group className="mb-0">
                  <Form.Label>Upload PDF (Max size: 10MB)</Form.Label>
                  <Form.Control
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    required
                  />
                </Form.Group>
                {selectedFile && (
                  <Form.Text className="text-muted">
                    Selected file: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </Form.Text>
                )}
              </div>
              <div style={{ width: '200px', marginTop: '32px' }}>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-100"
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? `Uploading... ${uploadProgress}%` : 'Upload'}
                </Button>
              </div>
            </div>
            {uploading && (
              <div className="mt-3">
                <div className="progress">
                  <div
                    className="progress-bar"
                    role="progressbar"
                    style={{ width: `${uploadProgress}%` }}
                    aria-valuenow={uploadProgress}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    {uploadProgress}%
                  </div>
                </div>
              </div>
            )}
          </Form>
        </Card.Body>
      </Card>

      <Row className="justify-content-center">
        {pdfs.map((pdf) => (
          <Col key={pdf._id} md={6} lg={4} className="mb-4">
            <Card className="h-100 shadow-sm">
              <Card.Body>
                <div className="text-center mb-3">
                  <div className="pdf-thumbnail mb-3">
                    <i className="bi bi-file-pdf text-danger" style={{ fontSize: '3rem' }}></i>
                  </div>
                  <Card.Title className="text-truncate">{pdf.title}</Card.Title>
                </div>
                <Card.Text>
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="text-muted">
                      {new Date(pdf.createdAt).toLocaleDateString()}
                    </small>
                    <div>
                      <Badge bg="secondary" className="me-2">
                        {formatFileSize(pdf.size)}
                      </Badge>
                    </div>
                  </div>
                </Card.Text>
                <div className="d-flex gap-2 mt-3">
                  <Button
                    as={Link}
                    to={`/pdf/${pdf._id}`}
                    variant="primary"
                    size="sm"
                    className="flex-grow-1"
                  >
                    View
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(pdf._id)}
                  >
                    Delete
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {pdfs.length === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-file-earmark-pdf text-primary" style={{ fontSize: '3rem' }}></i>
          <h4 className="mt-3">No recent uploads</h4>
          <p className="mb-0">Upload your first PDF using the form above.</p>
        </div>
      )}
    </Container>
  );
}

export default Dashboard; 