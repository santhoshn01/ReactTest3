import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders hello text', () => {
  render(<App />);
  expect(screen.getByText(/Hello, Santhosh!/i)).toBeInTheDocument();
});

test('increments count on button click', () => {
  render(<App />);
  const button = screen.getByText(/click me/i);
  fireEvent.click(button);
  expect(screen.getByText(/You clicked 1 times/i)).toBeInTheDocument();
});
