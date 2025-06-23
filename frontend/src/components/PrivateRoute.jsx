import { Navigate } from 'react-router-dom';
import { Alert } from 'react-bootstrap';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');

  if (!token) {
    return (
      <Alert variant="warning" className="text-center">
        Please log in to access this page.
        <Navigate to="/login" replace />
      </Alert>
    );
  }

  return children;
}

export default PrivateRoute; 