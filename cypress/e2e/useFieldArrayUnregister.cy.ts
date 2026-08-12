describe('useFieldArrayUnregister', () => {
  it('should behaviour correctly', () => {
    cy.visit('http://localhost:3000/UseFieldArrayUnregister');

    cy.get('#field0').clear().type('bill');

    cy.get('input[name="data.0.conditional"]').type('test');

    cy.get('#dirtyFields').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        data: [{ name: true, conditional: true }, null, null],
      }),
    );

    cy.get('input[name="data.0.conditional"]').blur();

    cy.get('#touched').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal([
        { name: true, conditional: true },
      ]),
    );

    cy.get('#prepend').click();

    cy.get('input[name="data.0.conditional"]').should('not.exist');
    cy.get('input[name="data.1.conditional"]').should('has.value', '');

    cy.get('#dirtyFields').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        data: [
          { name: true, conditional: true },
          { name: true, conditional: true },
          { name: true },
          { name: true },
        ],
      }),
    );

    cy.get('#touched').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal([
        null,
        { name: true, conditional: true },
      ]),
    );

    cy.get('input[name="data.0.name"]').blur();

    cy.get('#swap').click();

    cy.get('input[name="data.1.conditional"]').should('not.exist');
    cy.get('input[name="data.2.conditional"]').should('has.value', '');

    cy.get('#dirtyFields').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        data: [
          { name: true },
          null,
          { name: true, conditional: true },
          { name: true },
        ],
      }),
    );

    cy.get('#touched').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal([
        { name: true },
        null,
        { name: true, conditional: true },
      ]),
    );

    cy.get('#insert').click();

    cy.get('#insert').click();

    cy.get('input[name="data.4.name"]').type('test');

    cy.get('#dirtyFields').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        data: [
          { name: true },
          { name: true, conditional: true },
          { name: true },
          { name: true },
          { name: true, conditional: true },
          { name: true },
        ],
      }),
    );

    cy.get('#touched').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal([
        { name: true },
        { name: true },
        { name: true },
        null,
        { name: true, conditional: true },
      ]),
    );

    cy.get('#move').click();

    cy.get('input[name="data.2.name"]').clear().type('bill');

    cy.get('#dirtyFields').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        data: [
          { name: true },
          { name: true },
          { name: true, conditional: true },
          { name: true },
          { name: true },
          { name: true },
        ],
      }),
    );

    cy.get('#touched').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal([
        { name: true },
        { name: true },
        { name: true, conditional: true },
        { name: true },
        null,
      ]),
    );

    cy.get('#delete1').click();

    cy.get('#submit').click();

    cy.get('#result').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        data: [
          { name: '6' },
          { name: 'bill', conditional: '' },
          { name: '11' },
          { name: 'test1' },
          { name: 'test2' },
        ],
      }),
    );

    cy.get('input[name="data.3.name"]').type('test');

    cy.get('#submit').click();

    cy.get('#result').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        data: [
          { name: '6' },
          { name: 'bill', conditional: '' },
          { name: '11' },
          { name: 'test1test' },
          { name: 'test2' },
        ],
      }),
    );

    cy.get('#delete3').click();

    cy.get('#submit').click();

    cy.get('#result').should(($state) =>
      expect(JSON.parse($state.text())).to.be.deep.equal({
        data: [
          { name: '6' },
          { name: 'bill', conditional: '' },
          { name: '11' },
          { name: 'test2' },
        ],
      }),
    );

    cy.get('#renderCount').contains('26');
  });
});
