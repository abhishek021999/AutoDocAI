import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';

function Home() {
  const features = [
    {
      title: 'PDF Upload & Management',
      description: 'Securely upload and manage your PDF documents with a user-friendly interface. View file details and organize your library.',
      icon: '📄'
    },
    {
      title: 'Text Highlighting',
      description: 'Highlight important text in your PDFs with multiple color options (yellow, blue, green, pink, orange) for better organization.',
      icon: '🖍️'
    },
    {
      title: 'Comments & Notes',
      description: 'Add detailed comments to your highlights. View all annotations in a collapsible sidebar for easy reference.',
      icon: '💭'
    },
    {
      title: 'PDF Generation & Export',
      description: 'Generate new PDFs with your highlights and comments. Export annotated documents with all your notes and highlights preserved.',
      icon: '📤'
    },
    {
      title: 'Smart Search & Filter',
      description: 'Search through your PDFs and highlights. Sort documents by date, title, or size for efficient organization.',
      icon: '🔍'
    },
    {
      title: 'Dark Mode Support',
      description: 'Toggle between light and dark themes for comfortable viewing in any environment.',
      icon: '🌓'
    },
    {
      title: 'Responsive Design',
      description: 'Access your documents and annotations seamlessly across all devices with our responsive interface.',
      icon: '📱'
    }
  ];

  return (
    <Container>
      {/* Hero Section */}
      <Row className="text-center py-5">
        <Col>
          <h1 className="display-4 mb-4">Welcome to AutoDoc</h1>
          <p className="lead mb-4">
            Your all-in-one solution for PDF annotation and document management.
          </p>
          <Button
            as={Link}
            to="/register"
            variant="primary"
            size="lg"
            className="me-3"
          >
            Get Started
          </Button>
          <Button
            as={Link}
            to="/login"
            variant="outline-primary"
            size="lg"
          >
            Sign In
          </Button>
        </Col>
      </Row>

      {/* Features Section */}
      <Row className="py-5">
        <Col>
          <h2 className="text-center mb-5">Features</h2>
          <Row>
            {features.map((feature, index) => (
              <Col key={index} md={4} className="mb-4">
                <Card className="h-100 shadow-sm">
                  <Card.Body className="text-center">
                    <div className="display-4 mb-3">{feature.icon}</div>
                    <Card.Title>{feature.title}</Card.Title>
                    <Card.Text>{feature.description}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    </Container>
  );
}

export default Home; 