// Import testing utilities from React Testing Library
import { render, screen } from '@testing-library/react';
// Import the App component to be tested
import App from './App';


// Define a test case
test('renders learn react link', () => {

  // 1. Render the App component into a virtual DOM
  render(<App />);

  // 2. Look for an element that contains text matching "learn react" (case-insensitive)
  const linkElement = screen.getByText(/learn react/i);

  // 3. Assert that the element is present in the document
  expect(linkElement).toBeInTheDocument();
}
);
