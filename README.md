# eslint-rule-crawler
[ESLint](https://eslint.org/)是一个JavaScript/TypeScript代码规范工具，其内置了许多规则用于规范程序员的代码，可以提升代码可读性和减少低级错误的可能。

## 依赖
`cheerio`是一个为Node.js提供解析HTML/XML能力的工具，其有着与jQuery类似API
`axios`是JavaScript中最为流行的网络请求库
`promise-pool`提供批量并发。概念类似于其他编程语言中的线程池，如果是CPU密集型操作，和其他语言中的异步操作一样，在单个核心上运行。如果用于IO操作，会在Node.js的IO线程上运行，可以利用多核CPU。

## 代码解析
获取规则列表
```ts
// axios 发送 HTTP GET 请求
const rulesPage = await axios.get('https://eslint.org/docs/latest/rules/')
// cheerio 加载 HTML
const $ = cheerio.load(rulesPage.data as string)
// 使用 selector 选择所有规则，筛选不是弃用或移除的规则
const rules = $('article.rule').filter((i, el) => {
  return !($(el).hasClass('rule--deprecated') || $(el).hasClass('rule--removed'))
})/* 选择子节点，获取规则详细规则 */.children('div.rule__content').map((i, el) => {
  const ruleLink = $(el).children('a.rule__name')
  const ruleDesp = $(el).children('p.rule__description')
  return {
    // 规则名
    name: ruleLink.text(),
    // 规则详情页链接
    link: ruleLink.attr('href') ?? '',
    // 规则简要描述
    description: ruleDesp.text()
  }
}).toArray()
```
批量获取规则详情
```ts
const { results, errors } = await PromisePool.default
  .for(rules)
  // 设置并发数为10
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
    // 根据父元素的class进行分类
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
// 保存结果
fs.writeFileSync('./results.json', JSON.stringify(results))
```
