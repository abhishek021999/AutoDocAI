import { Container } from 'react-bootstrap';

function Footer() {
  return (
    <footer className="bg-dark text-light py-4 mt-auto">
      <Container className="text-center">
        <p className="mb-0">&copy; {new Date().getFullYear()} AutoDoc. All rights reserved.</p>
      </Container>
    </footer>
  );
}

export default Footer; 