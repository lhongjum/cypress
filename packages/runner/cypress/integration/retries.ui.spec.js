const helpers = require('../support/helpers')

const { shouldHaveTestResults, containText } = helpers
const { runIsolatedCypress, onInitialized } = helpers.createCypress({ config: { retries: 2 } })

const getAttemptTag = (sel) => {
  return cy.get(`.runnable-wrapper:contains(${sel}) .attempt-tag`)
}

const attemptTag = (sel) => `.runnable-wrapper .attempt-tag:contains(Attempt ${sel})`

describe('src/cypress/runner retries ui', () => {
  // NOTE: for test-retries
  it('can set retry config', () => {
    runIsolatedCypress({}, { config: { retries: 1 } })
    .then(({ autCypress }) => {
      expect(autCypress.config()).to.has.property('retries', 1)
    })
  })

  describe('retry ui', () => {
    beforeEach(() => {
      runIsolatedCypress({
        suites: {
          'suite 1': {
            tests: [
              { name: 'test 1', fail: 1 },
              { name: 'test 2', fail: 2 },
              { name: 'test 3', fail: 1 },
            ],
          },
        },
      }, { config: { retries: 1 } })
      .then(shouldHaveTestResults(2, 1))
    })

    it('can toggle failed attempt', () => {
      cy.contains('.runnable-wrapper', 'test 3').click().within(() => {
        cy.get('.runnable-err-print').should('not.be.visible')
        cy.contains('Attempt 1').click()
        cy.get('.runnable-err-print').should('be.visible')
        cy.contains('Attempt 1').click()
        // .find('i:last').pseudo(':before').should('have.property', 'content', '""')
        cy.get('.runnable-err-print').should('not.be.visible')
      })
    })

    it('can view error for failed attempt', () => {
      cy.contains('Attempt 1')
      .click()
      .closest('.attempt-item')
      .find('.runnable-err-print')
      .click()

      cy.get('@console_log').should('be.calledWithMatch', 'Command')
    })
  })

  it('simple retry', () => {
    runIsolatedCypress({
      suites: {
        'suite 1': {
          tests: [
            { name: 'test 1',
              fail: 1,
            },
          ],
        },
      },
    }, { config: { retries: 1 } })
    .then(shouldHaveTestResults(1, 0))
  })

  // TODO: fix this test
  it.skip('takes screenshots properly on every attempt failure', () => {
    onInitialized((autCypress) => {
      let count = 0

      autCypress.Screenshot.onAfterScreenshot = cy.stub().callsFake(() => {
        cy.wrap(null).then(() => {
          count++
          expect(cy.$$(`.attempt:contains(Attempt ${count}).runnable-err`)).be.visible
        })
      })
    })

    runIsolatedCypress({
      suites: {
        'suite 1': {
          tests: [
            'foo',
            { name: 'test 1',
              fail: 3,
            },
          ],
        },
      },
    }, { config: { retries: 3, isTextTerminal: true } })
    // .then(shouldHaveTestResults(1, 0))
    // .then(() => {

    // })
  })

  it('test retry with hooks', () => {
    runIsolatedCypress({
      suites: {
        'suite 1': {
          hooks: ['before', 'beforeEach', 'afterEach', 'after'],
          tests: [{ name: 'test 1', fail: 1 }],
        },
      },
    }, { config: { retries: 1 } })
    .then(shouldHaveTestResults(1, 0))
    .then(() => {
      cy.contains('test')
      cy.contains('after all')
    })
  })

  it('test retry with [only]', () => {
    runIsolatedCypress({
      suites: {
        'suite 1': {
          hooks: ['before', 'beforeEach', 'afterEach', 'after'],
          tests: [
            { name: 'test 1' },
            { name: 'test 2', fail: 1, only: true },
            { name: 'test 3' },
          ],
        },
      },
    }, { config: { retries: 1 } })
    .then(shouldHaveTestResults(1, 0))
  })

  it('test retry with many hooks', () => {
    runIsolatedCypress({
      suites: {
        'suite 1': {
          hooks: [
            'before',
            'beforeEach',
            'afterEach',
            'after',
          ],
          tests: [
            { name: 'test 1' },
            { name: 'test 2', fail: 1 },
            { name: 'test 3' },
          ],
        },
      },
    }, { config: { retries: 1 } })
    .then(shouldHaveTestResults(3, 0))
  })

  it('can retry from [beforeEach]', () => {
    runIsolatedCypress({
      suites: {
        'suite 1': {
          hooks: [
            'before',
            'beforeEach',
            { type: 'beforeEach', fail: 1 },
            'beforeEach',
            'afterEach',
            'after',
          ],
          tests: [{ name: 'test 1' }],
        },
      },
    }, { config: { retries: 1 } })
    .then(shouldHaveTestResults(1, 0))
    .then(() => {
      cy.contains('Attempt 1').click()
      cy.get('.runnable-err-print').click()
      cy.get('@reporterBus').its('lastCall.args').should('contain', 'runner:console:error')
    })
  })

  it('can retry from [afterEach]', () => {
    runIsolatedCypress({
      hooks: [{ type: 'afterEach', fail: 1 }],
      suites: {
        'suite 1': {
          hooks: [
            'before',
            'beforeEach',
            'beforeEach',
            'afterEach',
            'after',
          ],
          tests: [{ name: 'test 1' }, 'test 2', 'test 3'],
        },
        'suite 2': {
          hooks: [{ type: 'afterEach', fail: 2 }],
          tests: ['test 1'],
        },
        'suite 3': {
          tests: ['test 1'],
        },
      },
    }, { config: { retries: 2, isTextTerminal: true } })
    .then(shouldHaveTestResults(5, 0))
    .then(() => {
      cy.contains('test 1')
      cy.contains('Attempt 1').click()
      cy.get('.runnable-err-print').click()
      cy.get('@reporterBus').its('lastCall.args').should('contain', 'runner:console:error')
    })
  })

  it('cant retry from [before]', () => {
    runIsolatedCypress({
      suites: {
        'suite 1': {
          hooks: [
            { type: 'before', fail: 1 },
            'beforeEach',
            'beforeEach',
            'afterEach',
            'afterEach',
            'after',
          ],
          tests: [{ name: 'test 1' }],
        },
      },
    }, { config: { retries: 1 } })
    .then(shouldHaveTestResults(0, 1))
    .then(() => {
      // cy.contains('Attempt 1').click()
      cy.contains('Although you have test retries')
      cy.get('.runnable-err-print').click()
      cy.get('@console_error').its('lastCall').should('be.calledWithMatch', 'Error')
    })
  })

  it('cant retry from [after]', () => {
    runIsolatedCypress({
      suites: {
        'suite 1': {
          hooks: [
            'before',
            'beforeEach',
            'beforeEach',
            'afterEach',
            'afterEach',
            { type: 'after', fail: 1 },
          ],
          tests: [{ name: 'test 1' }],
        },
      },
    }, { config: { retries: 1 } })
    .then(shouldHaveTestResults(0, 1))
    .then(() => {
      cy.contains('Although you have test retries')
      cy.get('.runnable-err-print').click()
      cy.get('@console_error').its('lastCall').should('be.calledWithMatch', 'Error')
    })
  })

  it('includes routes, spies, hooks, and commands in attempt', () => {
    runIsolatedCypress({
      suites: {
        's1': {
          hooks: [{ type: 'beforeEach', fail: 1, agents: true }],
          tests: [{ name: 't1', fail: 1, agents: true }],
        },
      },
    })
    .then(shouldHaveTestResults(1, 0))
    .then(() => {
      cy.get(attemptTag`1`).click().parentsUntil('.collapsible').last().parent().within(() => {
        cy.get('.instruments-container').should('contain', 'Spies / Stubs (1)')
        cy.get('.instruments-container').should('contain', 'Routes (1)')
        cy.get('.runnable-err').should('contain', 'AssertionError')
      })

      cy.get(attemptTag`2`).click().parentsUntil('.collapsible').last().parent().within(() => {
        cy.get('.instruments-container').should('contain', 'Spies / Stubs (2)')
        cy.get('.instruments-container').should('contain', 'Routes (2)')
        cy.get('.runnable-err').should('contain', 'AssertionError')
      })

      cy.get(attemptTag`3`).parentsUntil('.collapsible').last().parent().within(() => {
        cy.get('.instruments-container').should('contain', 'Spies / Stubs (2)')
        cy.get('.instruments-container').should('contain', 'Routes (2)')
        cy.get('.runnable-err').should('not.contain', 'AssertionError')
      })
    })
  })

  // NOTE: for test-retries
  describe('can configure retries', () => {
    it('via config value', () => {
      runIsolatedCypress({
        suites: {
          'suite 1': () => {
            Cypress.config('retries', 0)
            it('[no retry]', () => assert(false))
            Cypress.config('retries', 1)
            it('[1 retry]', () => assert(false))
            Cypress.config('retries', 2)
            it('[2 retries]', () => assert(false))

            // it('[test-config no retries]', { retries: 0 }, () => assert(false))
            // it('[test-config 1 retry]', { retries: 1 }, () => assert(false))

            Cypress.config('retries', { runMode: 2, openMode: 0 })
            Cypress.config('isInteractive', true)
            it('[open mode, no retry]', () => assert(false))

            Cypress.config('retries', { runMode: 0, openMode: 2 })
            Cypress.config('isInteractive', false)
            it('[run mode, no retry]', () => assert(false))

            Cypress.config('retries', { runMode: 0, openMode: 2 })
            Cypress.config('isInteractive', true)
            it('[open mode, 2 retries]', () => assert(false))
          },
        },
      })

      .then(shouldHaveTestResults(0, 6))
      .then(() => {
        getAttemptTag('[no retry]').should('not.be.visible')
        getAttemptTag('[1 retry]').should('have.length', 2)
        getAttemptTag('[2 retries]').should('have.length', 3)
        //   getAttemptTag('[test-config no retries]').should('not.be.visible')
        //   getAttemptTag('[test-config 1 retry]').should('have.length', 2)
        getAttemptTag('[open mode, no retry]').should('not.be.visible')
        getAttemptTag('[run mode, no retry]').should('not.be.visible')
        getAttemptTag('[open mode, 2 retries]').should('have.length', 3)
      })
    })

    it('throws when set via this.retries in test', () => {
      runIsolatedCypress({
        suites: {
          'suite 1' () {
            it('test 1', () => {
              this.retries(0)
            })
          },
        },
      })
      .then(shouldHaveTestResults(0, 1))
      .then(() => {
        cy.get('.runnable-err').should(containText('retries'))
      })
    })

    it('throws when set via this.retries in hook', () => {
      runIsolatedCypress({
        suites: {
          'suite 1' () {
            beforeEach(() => {
              this.retries(0)
            })

            it('foo', () => {})
          },
        },
      })
      .then(shouldHaveTestResults(0, 1))
      .then(() => {
        cy.get('.runnable-err').should(containText('retries'))
      })
    })

    it('throws when set via this.retries in suite', () => {
      runIsolatedCypress({
        suites: {
          'suite 1' () {
            this.retries(0)
            it('test 1', () => {
            })
          },
        },
      })
      .then(shouldHaveTestResults(0, 1))
      .then(() => {
        cy.get('.runnable-err').should(containText('retries'))
      })
    })

    it('simple failing hook spec', () => {
      const mochaTests = {
        suites: {
          'simple failing hook spec': {
            suites: {
              'beforeEach hooks': {
                hooks: [{ type: 'beforeEach', fail: true }],
                tests: ['fails in beforeEach'],
              },
              'pending': {
                tests: [{ name: 'is pending', pending: true }],
              },
              'afterEach hooks': {
                hooks: [{ type: 'afterEach', fail: true }],
                tests: ['fails this', 'does not run this'],
              },
              'after hooks': {
                hooks: [{ type: 'after', fail: true }]
                , tests: ['runs this', 'fails on this'],
              },
            },
          },

        },
      }

      runIsolatedCypress(mochaTests, { config: { retries: 1 } })
      .then(shouldHaveTestResults(1, 3))
      .then(() => {
        cy.contains('.test', 'fails on this').should('have.class', 'runnable-failed')
        .within(() => {
          cy.contains('.command', 'after').should('have.class', 'command-state-failed')
          cy.contains('.runnable-err', 'AssertionError').should('be.visible')
        })

        cy.contains('.test', 'fails in beforeEach').should('have.class', 'runnable-failed')
        .within(() => {
          cy.contains('.command', 'beforeEach').should('have.class', 'command-state-failed')

          // make sure Attempt 1 is collapsed
          cy.get('.attempt-item').first().find('.commands-container').should('not.exist')
        })

        cy.contains('.test', 'is pending').should('have.class', 'runnable-pending')

        cy.contains('.test', 'fails this').should('have.class', 'runnable-failed')
        .within(() => {
          cy.contains('.command', 'afterEach').should('have.class', 'command-state-failed')
          cy.contains('.runnable-err', 'AssertionError').should('be.visible')
        })

        cy.contains('.test', 'does not run this').should('have.class', 'runnable-processing')

        cy.contains('.test', 'runs this').should('have.class', 'runnable-passed')
      })
    })
  })
})
