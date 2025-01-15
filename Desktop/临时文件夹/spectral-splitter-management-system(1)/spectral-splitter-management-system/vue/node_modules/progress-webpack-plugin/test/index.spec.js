let webpack = require('webpack')
let expect = require('chai').expect
let path = require('path')
let ProgressPlugin = require('../')

const OUTPUT_PATH = path.join(__dirname, 'dist')

describe('Progress Plugin', () => {
  it('should output correctly', done => {
    let compiler = webpack(
      {
        entry: {
          main: path.join(__dirname, 'fixture', 'entry.js')
        },
        mode: 'production',
        output: {
          path: OUTPUT_PATH,
          filename: '[name].min.js'
        },
        plugins: [
          new ProgressPlugin({
            identifier: 'test'
          })
        ]
      },
      (err, stats) => {
        expect(err).to.equal(null)
        done()
      }
    )
  })
})
