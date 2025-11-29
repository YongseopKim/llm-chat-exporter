/**
 * Scroller Validation Test for Claude
 *
 * PURPOSE: Validate that scrolling to top of Claude conversations
 * loads all virtualized messages into the DOM.
 *
 * USAGE:
 * 1. Open a Claude conversation with 20+ messages
 * 2. Scroll to middle of conversation
 * 3. Open browser console (F12)
 * 4. Paste this entire script and press Enter
 * 5. Wait 8-10 seconds for test to complete
 * 6. Check console output for PASS/FAIL result
 */

(function() {
  console.log('=== CLAUDE SCROLLER VALIDATION TEST ===');
  console.log('Starting test...\n');

  // Test 1: Measure initial message count
  const initialMessages = document.querySelectorAll('[data-testid="user-message"], .font-claude-response').length;
  console.log('Test 1: Initial message count');
  console.log('  Initial messages visible:', initialMessages);

  if (initialMessages === 0) {
    console.error('❌ FAIL: No messages found. Check selectors or page structure.');
    return;
  }

  // Test 2: Scroll to top and wait
  console.log('\nTest 2: Scroll to top');
  window.scrollTo(0, 0);
  console.log('  Scrolled to top, waiting 2 seconds...');

  setTimeout(() => {
    const afterScrollMessages = document.querySelectorAll('[data-testid="user-message"], .font-claude-response').length;
    console.log('  Messages after scroll to top:', afterScrollMessages);
    console.log('  New messages loaded:', afterScrollMessages - initialMessages);

    // Test 3: Scroll down then up again
    console.log('\nTest 3: Scroll to bottom and back');
    window.scrollTo(0, document.body.scrollHeight);
    console.log('  Scrolled to bottom, waiting 2 seconds...');

    setTimeout(() => {
      console.log('  Scrolling back to top...');
      window.scrollTo(0, 0);

      setTimeout(() => {
        const finalMessages = document.querySelectorAll('[data-testid="user-message"], .font-claude-response').length;
        console.log('  Final message count:', finalMessages);

        // Test 4: Check if messages are actually in DOM or just placeholders
        console.log('\nTest 4: Content validation');
        const userMessages = document.querySelectorAll('[data-testid="user-message"]');
        const assistantMessages = document.querySelectorAll('.font-claude-response');

        let emptyMessages = 0;
        userMessages.forEach(msg => {
          if (msg.textContent.trim().length === 0) emptyMessages++;
        });
        assistantMessages.forEach(msg => {
          if (msg.textContent.trim().length === 0) emptyMessages++;
        });

        const hasContent = emptyMessages === 0;
        console.log('  Total messages:', finalMessages);
        console.log('  Empty messages:', emptyMessages);
        console.log('  All messages have content:', hasContent);

        // Test 5: Check for virtualization indicators
        console.log('\nTest 5: Virtualization check');
        const viewportHeight = window.innerHeight;
        const scrollHeight = document.body.scrollHeight;
        const messagesPerScreen = Math.ceil(finalMessages / (scrollHeight / viewportHeight));
        console.log('  Viewport height:', viewportHeight);
        console.log('  Total scroll height:', scrollHeight);
        console.log('  Estimated messages per screen:', messagesPerScreen);

        // Results
        console.log('\n=== RESULTS ===');
        console.log('Initial:', initialMessages);
        console.log('After top scroll:', afterScrollMessages);
        console.log('Final:', finalMessages);
        console.log('Messages loaded during test:', finalMessages - initialMessages);

        console.log('\n=== DECISION ===');
        if (finalMessages >= initialMessages && hasContent) {
          if (finalMessages > initialMessages) {
            console.log('✅ PASS: Scroller loads additional messages');
            console.log('📋 RECOMMENDATION: Implement full scroller with MutationObserver');
            console.log('📊 CONFIDENCE: HIGH - New messages loaded successfully');
          } else {
            console.log('⚠️ PARTIAL: No new messages loaded, but content accessible');
            console.log('📋 RECOMMENDATION: Implement simplified scroller (scroll to top only)');
            console.log('📊 CONFIDENCE: MEDIUM - May be short conversation or already fully loaded');
          }
        } else {
          console.log('❌ FAIL: Messages not loading or empty');
          console.log('📋 RECOMMENDATION: Use Fallback 1 (export visible messages only)');
          console.log('📊 CONFIDENCE: HIGH - DOM virtualization not working as expected');
        }

        console.log('\n=== NEXT STEPS ===');
        console.log('1. Copy the DECISION section above');
        console.log('2. Report results to Claude Code');
        console.log('3. Claude will implement appropriate strategy based on results');
      }, 2000);
    }, 2000);
  }, 2000);
})();
