describe('My First E2E Test', () => {
  it('should load the homepage and click the button', () => {
    cy.visit('http://localhost:3000'); // Make sure your app is running
    cy.contains('Hello, Santhosh!');   // Checks if heading is present
    cy.contains('Click me').click();   // Simulates button click
    cy.contains('You clicked 1 times'); // Verifies click increment
  });
});
