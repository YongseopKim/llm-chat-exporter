/**
 * Shadow DOM Detection Test for Gemini
 *
 * PURPOSE: Determine if Gemini uses Shadow DOM and requires
 * a recursive queryShadowSelector() utility.
 *
 * USAGE:
 * 1. Open a Gemini conversation (any length)
 * 2. Open browser console (F12)
 * 3. Paste this entire script and press Enter
 * 4. Check console output for Shadow DOM detection result
 */

(function() {
  console.log('=== GEMINI SHADOW DOM DETECTION TEST ===');
  console.log('Starting test...\n');

  // Test 1: Check if custom elements exist
  console.log('Test 1: Custom element detection');
  const userQueries = document.querySelectorAll('user-query');
  const modelResponses = document.querySelectorAll('model-response');

  console.log('  user-query elements found:', userQueries.length);
  console.log('  model-response elements found:', modelResponses.length);

  if (userQueries.length === 0 && modelResponses.length === 0) {
    console.error('❌ FAIL: No Gemini custom elements found.');
    console.error('  Make sure you are on gemini.google.com in an active conversation.');
    return;
  }

  // Test 2: Check if custom elements have shadowRoot
  console.log('\nTest 2: Shadow DOM attachment check');
  let hasShadowDOM = false;
  let shadowDOMElements = [];

  userQueries.forEach((el, i) => {
    if (el.shadowRoot) {
      console.log(`  ✓ user-query[${i}] HAS shadowRoot (mode: ${el.shadowRoot.mode || 'unknown'})`);
      hasShadowDOM = true;
      shadowDOMElements.push({ type: 'user-query', index: i, element: el });
    }
  });

  modelResponses.forEach((el, i) => {
    if (el.shadowRoot) {
      console.log(`  ✓ model-response[${i}] HAS shadowRoot (mode: ${el.shadowRoot.mode || 'unknown'})`);
      hasShadowDOM = true;
      shadowDOMElements.push({ type: 'model-response', index: i, element: el });
    }
  });

  if (!hasShadowDOM) {
    console.log('  ✗ No shadowRoot found on custom elements');
  }

  // Test 3: Content accessibility check
  console.log('\nTest 3: Content accessibility');
  const firstUserQuery = userQueries[0];
  const firstModelResponse = modelResponses[0];

  if (firstUserQuery) {
    const contentViaText = firstUserQuery.textContent?.substring(0, 100);
    const contentViaQuery = firstUserQuery.querySelector('.query-text')?.textContent?.substring(0, 100);

    console.log('  user-query content via textContent:', contentViaText ? `"${contentViaText}..."` : 'null');
    console.log('  user-query content via querySelector:', contentViaQuery ? `"${contentViaQuery}..."` : 'null');
    console.log('  Content accessible without shadowRoot:', contentViaQuery !== null);
  }

  if (firstModelResponse) {
    const contentViaText = firstModelResponse.textContent?.substring(0, 100);
    const contentViaQuery = firstModelResponse.querySelector('.response-container-content')?.textContent?.substring(0, 100);

    console.log('  model-response content via textContent:', contentViaText ? `"${contentViaText}..."` : 'null');
    console.log('  model-response content via querySelector:', contentViaQuery ? `"${contentViaQuery}..."` : 'null');
    console.log('  Content accessible without shadowRoot:', contentViaQuery !== null);
  }

  // Test 4: Deep search for ANY shadowRoot in document
  console.log('\nTest 4: Deep Shadow DOM scan');
  const allElements = document.querySelectorAll('*');
  let shadowRootCount = 0;
  const shadowRootTypes = new Set();

  allElements.forEach(el => {
    if (el.shadowRoot) {
      shadowRootCount++;
      shadowRootTypes.add(el.tagName.toLowerCase());
    }
  });

  console.log('  Total elements scanned:', allElements.length);
  console.log('  Elements with shadowRoot:', shadowRootCount);
  console.log('  Element types with shadowRoot:', Array.from(shadowRootTypes).join(', ') || 'none');

  // Test 5: If Shadow DOM exists, test traversal
  if (hasShadowDOM && shadowDOMElements.length > 0) {
    console.log('\nTest 5: Shadow DOM content traversal');
    const testElement = shadowDOMElements[0];
    const shadowRoot = testElement.element.shadowRoot;

    if (shadowRoot) {
      const shadowChildren = shadowRoot.querySelectorAll('*');
      console.log(`  Shadow DOM children in ${testElement.type}[${testElement.index}]:`, shadowChildren.length);

      if (shadowChildren.length > 0) {
        console.log('  First 5 child tags:',
          Array.from(shadowChildren)
            .slice(0, 5)
            .map(el => el.tagName.toLowerCase())
            .join(', ')
        );
      }
    }
  }

  // Results
  console.log('\n=== RESULTS ===');
  console.log('Custom elements found:', userQueries.length + modelResponses.length);
  console.log('Shadow DOM detected:', hasShadowDOM ? 'YES' : 'NO');
  console.log('Total Shadow DOMs in page:', shadowRootCount);
  console.log('Content accessible via standard queries:',
    firstUserQuery?.querySelector('.query-text') !== undefined
  );

  console.log('\n=== DECISION ===');
  if (hasShadowDOM || shadowRootCount > 0) {
    console.log('✅ Shadow DOM CONFIRMED');
    console.log('📋 RECOMMENDATION: Implement queryShadowSelector() utility');
    console.log('📊 DETAILS:');
    console.log('  - Implement recursive Shadow DOM traversal');
    console.log('  - Use for Gemini parser content extraction');
    console.log('  - Test with both open and closed shadow roots');
    console.log('📝 IMPLEMENTATION PRIORITY: HIGH');
  } else {
    console.log('❌ Shadow DOM NOT DETECTED');
    console.log('📋 RECOMMENDATION: Skip Shadow DOM utility');
    console.log('📊 DETAILS:');
    console.log('  - Content accessible via standard querySelector');
    console.log('  - Use normal DOM traversal in Gemini parser');
    console.log('  - Save ~2 hours of implementation time');
    console.log('📝 IMPLEMENTATION PRIORITY: SKIP');
  }

  console.log('\n=== NEXT STEPS ===');
  console.log('1. Copy the DECISION section above');
  console.log('2. Report results to Claude Code');
  console.log('3. Claude will adjust implementation plan accordingly');
})();
