describe('hotKeys', () => {
    it('BasicUsage', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/hotkeys--demo')
        cy.wait(1000)

        cy.get('body').click().type('{control}{k}')
        cy.get('pre#pre').should('exist').and('have.text', '1')
    });

    it('Combine', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/hotkeys--combine')

        cy.get('body').click().type('{meta}{alt}{k}').type('{meta}{shift}{k}')
        cy.get('pre#pre').should('exist').and('have.text', '2')
    });

    it('Target', () => {
        cy.visit('http://127.0.0.1:6006/iframe.html?path=/story/hotkeys--target')

        cy.get('input#test').type('{meta}{s}')
        cy.get('pre#pre').should('exist').and('have.text', '1')
    });
});