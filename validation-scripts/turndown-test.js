/**
 * Turndown HTML→Markdown Conversion Test
 *
 * PURPOSE: Validate that Turndown library correctly converts
 * LLM conversation HTML (code blocks, tables, lists) to Markdown.
 *
 * USAGE:
 * 1. Open any browser console (F12) - any website works
 * 2. Paste this entire script and press Enter
 * 3. Wait for Turndown library to load from CDN
 * 4. Check console output for conversion test results
 */

(function() {
  console.log('=== TURNDOWN HTML→MARKDOWN VALIDATION TEST ===');
  console.log('Loading Turndown library from CDN...\n');

  // Load Turndown from CDN for testing
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/turndown@7.2.0/dist/turndown.js';

  script.onerror = () => {
    console.error('❌ FAIL: Could not load Turndown library from CDN');
    console.error('  Check internet connection or try again');
  };

  script.onload = () => {
    console.log('✓ Turndown library loaded successfully\n');

    const TurndownService = window.TurndownService;
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      fence: '```'
    });

    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Code block with language
    console.log('Test 1: Code block with language attribute');
    const codeHtml = '<pre><code class="language-python">def hello():\n    print("hi")</code></pre>';
    const codeMd = turndownService.turndown(codeHtml);
    console.log('  Input:', codeHtml);
    console.log('  Output:', codeMd);
    const preservesLanguage = codeMd.includes('python');
    console.log('  Preserves language?', preservesLanguage ? '✅ YES' : '❌ NO (needs custom rule)');
    if (!preservesLanguage) {
      console.log('  ⚠️  Default Turndown does NOT preserve code block language');
      console.log('  📋  Will need custom rule (see DESIGN.md lines 410-417)');
      testsFailed++;
    } else {
      testsPassed++;
    }

    // Test 2: Table conversion
    console.log('\nTest 2: Table to Markdown');
    const tableHtml = '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody></table>';
    const tableMd = turndownService.turndown(tableHtml);
    console.log('  Input: <table>...</table>');
    console.log('  Output:', tableMd);
    const validTable = tableMd.includes('|') && tableMd.includes('---');
    console.log('  Valid markdown table?', validTable ? '✅ YES' : '❌ NO');
    validTable ? testsPassed++ : testsFailed++;

    // Test 3: Nested lists
    console.log('\nTest 3: Nested lists');
    const listHtml = '<ul><li>Item 1<ul><li>Subitem A</li><li>Subitem B</li></ul></li><li>Item 2</li></ul>';
    const listMd = turndownService.turndown(listHtml);
    console.log('  Input: <ul><li>nested...</li></ul>');
    console.log('  Output:', listMd);
    const preservesNesting = listMd.includes('  -') || listMd.includes('  *') || listMd.includes('    -');
    console.log('  Preserves nesting?', preservesNesting ? '✅ YES' : '❌ NO');
    preservesNesting ? testsPassed++ : testsFailed++;

    // Test 4: Inline code
    console.log('\nTest 4: Inline code');
    const inlineHtml = '<p>Use <code>console.log()</code> for debugging</p>';
    const inlineMd = turndownService.turndown(inlineHtml);
    console.log('  Input:', inlineHtml);
    console.log('  Output:', inlineMd);
    const usesBackticks = inlineMd.includes('`console.log()`');
    console.log('  Uses backticks?', usesBackticks ? '✅ YES' : '❌ NO');
    usesBackticks ? testsPassed++ : testsFailed++;

    // Test 5: Bold and italic
    console.log('\nTest 5: Bold and italic');
    const emphasisHtml = '<p>This is <strong>bold</strong> and <em>italic</em></p>';
    const emphasisMd = turndownService.turndown(emphasisHtml);
    console.log('  Input:', emphasisHtml);
    console.log('  Output:', emphasisMd);
    const preservesEmphasis = (emphasisMd.includes('**bold**') || emphasisMd.includes('__bold__')) &&
                              (emphasisMd.includes('*italic*') || emphasisMd.includes('_italic_'));
    console.log('  Preserves emphasis?', preservesEmphasis ? '✅ YES' : '❌ NO');
    preservesEmphasis ? testsPassed++ : testsFailed++;

    // Test 6: Links
    console.log('\nTest 6: Links');
    const linkHtml = '<p>Check out <a href="https://example.com">this link</a></p>';
    const linkMd = turndownService.turndown(linkHtml);
    console.log('  Input:', linkHtml);
    console.log('  Output:', linkMd);
    const validLink = linkMd.includes('[this link](https://example.com)');
    console.log('  Valid markdown link?', validLink ? '✅ YES' : '❌ NO');
    validLink ? testsPassed++ : testsFailed++;

    // Test 7: Headings
    console.log('\nTest 7: Headings (atx style)');
    const headingHtml = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
    const headingMd = turndownService.turndown(headingHtml);
    console.log('  Input:', headingHtml);
    console.log('  Output:', headingMd);
    const atxStyle = headingMd.includes('# Title') && headingMd.includes('## Subtitle') && headingMd.includes('### Section');
    console.log('  Uses atx style (#)?', atxStyle ? '✅ YES' : '❌ NO');
    atxStyle ? testsPassed++ : testsFailed++;

    // Test 8: Code block without language
    console.log('\nTest 8: Code block without language');
    const plainCodeHtml = '<pre><code>git commit -m "message"</code></pre>';
    const plainCodeMd = turndownService.turndown(plainCodeHtml);
    console.log('  Input:', plainCodeHtml);
    console.log('  Output:', plainCodeMd);
    const usesFencedCode = plainCodeMd.includes('```') && plainCodeMd.includes('git commit');
    console.log('  Uses fenced code blocks?', usesFencedCode ? '✅ YES' : '❌ NO');
    usesFencedCode ? testsPassed++ : testsFailed++;

    // Test 9: Complex nested HTML (LLM-like structure)
    console.log('\nTest 9: Complex nested HTML');
    const complexHtml = `<div>
      <p>Here's a code example:</p>
      <pre><code class="language-javascript">function add(a, b) {
  return a + b;
}</code></pre>
      <p>And a list:</p>
      <ul>
        <li>First item</li>
        <li>Second item</li>
      </ul>
    </div>`;
    const complexMd = turndownService.turndown(complexHtml);
    console.log('  Input: <div>complex nested HTML...</div>');
    console.log('  Output:', complexMd);
    const preservesStructure = complexMd.includes('code example') &&
                                complexMd.includes('function add') &&
                                complexMd.includes('- First item');
    console.log('  Preserves structure?', preservesStructure ? '✅ YES' : '❌ NO');
    preservesStructure ? testsPassed++ : testsFailed++;

    // Results
    console.log('\n=== TEST SUMMARY ===');
    console.log('Tests passed:', testsPassed, '/ 9');
    console.log('Tests failed:', testsFailed, '/ 9');
    console.log('Success rate:', Math.round((testsPassed / 9) * 100) + '%');

    console.log('\n=== DETAILED FINDINGS ===');
    if (!preservesLanguage) {
      console.log('⚠️  Code block language NOT preserved by default');
      console.log('   Solution: Add custom Turndown rule (DESIGN.md lines 410-417)');
    }
    if (testsPassed >= 7) {
      console.log('✅ Turndown handles most conversions well');
    }
    if (testsFailed > 2) {
      console.log('⚠️  Multiple conversion issues detected');
      console.log('   May need additional custom rules or hybrid approach');
    }

    console.log('\n=== DECISION ===');
    if (testsPassed >= 7) {
      console.log('✅ PASS: Turndown is suitable for LLM content');
      console.log('📋 RECOMMENDATION: Implement converter with custom rules');
      console.log('📊 DETAILS:');
      console.log('  - Use Turndown library (already in package.json)');
      console.log('  - Add custom rule for code block language preservation');
      console.log('  - Add custom rules for any other failing tests');
      console.log('  - Test with real LLM HTML from samples/ directory');
      console.log('📝 CUSTOM RULES NEEDED:', testsFailed);
    } else {
      console.log('⚠️ PARTIAL: Turndown needs significant customization');
      console.log('📋 RECOMMENDATION: Hybrid approach or alternative library');
      console.log('📊 DETAILS:');
      console.log('  - Consider preserving HTML for complex blocks');
      console.log('  - Use Turndown for basic text/paragraphs');
      console.log('  - Investigate alternative libraries (e.g., remark-rehype)');
      console.log('📝 CUSTOM RULES NEEDED:', testsFailed);
    }

    console.log('\n=== NEXT STEPS ===');
    console.log('1. Copy the DECISION section above');
    console.log('2. Report results to Claude Code');
    console.log('3. Claude will implement converter with appropriate custom rules');
    console.log('4. Test converter with real HTML from samples/*.html files');
  };

  document.head.appendChild(script);
})();
