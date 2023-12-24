import * as cheerio from 'cheerio'
import axios from 'axios'
import PromisePool from '@supercharge/promise-pool'
import fs from 'fs'

const rulesPage = await axios.get('https://eslint.org/docs/latest/rules/')
const $ = cheerio.load(rulesPage.data as string)
const rules = $('article.rule').filter((i, el) => {
  return !($(el).hasClass('rule--deprecated') || $(el).hasClass('rule--removed'))
}).children('div.rule__content').map((i, el) => {
  const ruleLink = $(el).children('a.rule__name')
  const ruleDesp = $(el).children('p.rule__description')
  return {
    name: ruleLink.text(),
    link: ruleLink.attr('href') ?? '',
    description: ruleDesp.text()
  }
}).toArray()
console.log(`found ${rules.length} rules`)
const { results, errors } = await PromisePool.default
  .for(rules)
  .withConcurrency(10)
  .process(async rule => {
    const rulePage = await axios.get(`https://eslint.org${(rule).link}`)
    const $ = cheerio.load(rulePage.data as string)
    const codeSinppets = $('pre')
    const res: {
      unclassified: string[]
      correct: string[]
      incorrect: string[]
    } = {
      ...(rule),
      unclassified: [],
      correct: [],
      incorrect: []
    }
    codeSinppets.each((i, el) => {
      const code = $(el).children('code').text()
      if ($(el).parent().hasClass('correct')) {
        res.correct.push(code)
      } else if ($(el).parent().hasClass('incorrect')) {
        res.incorrect.push(code)
      } else {
        res.unclassified.push(code)
      }
    })
    return res
  })
console.log(`fetch finished ${errors.length} errors`)
if (errors.length > 0) {
  console.log(errors)
}
fs.writeFileSync('./results.json', JSON.stringify(results))
