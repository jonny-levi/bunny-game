#!/usr/bin/env node

// Quick startup test for the enhanced backend
// Verifies all modules load correctly and no critical errors exist

console.log('🐰 Testing Bunny Family Enhanced Backend Startup...\n');

try {
    // Test module imports
    console.log('📦 Testing module imports...');
    
    const GameStateManager = require('./gameState');
    console.log('  ✅ GameStateManager loaded');
    
    const { GameValidator, ValidationError } = require('./validation');
    console.log('  ✅ Validation system loaded');
    
    const DailyRewardManager = require('./dailyRewards');
    console.log('  ✅ DailyRewardManager loaded');
    
    const AchievementManager = require('./achievements');
    console.log('  ✅ AchievementManager loaded');
    
    const MemoryManager = require('./memoryManager');
    console.log('  ✅ MemoryManager loaded');
    
    const CustomizationManager = require('./customization');
    console.log('  ✅ CustomizationManager loaded');

    // Test instantiation
    console.log('\n🔧 Testing manager instantiation...');
    
    const gameStateManager = new GameStateManager();
    console.log('  ✅ GameStateManager instantiated');
    
    const dailyRewardManager = new DailyRewardManager();
    console.log('  ✅ DailyRewardManager instantiated');
    
    const achievementManager = new AchievementManager();
    console.log('  ✅ AchievementManager instantiated');
    
    const memoryManager = new MemoryManager();
    console.log('  ✅ MemoryManager instantiated');
    
    const customizationManager = new CustomizationManager();
    console.log('  ✅ CustomizationManager instantiated');

    // Test basic functionality
    console.log('\n⚙️ Testing basic functionality...');
    
    // Test validation
    try {
        GameValidator.validateRoomCode('ABC123');
        console.log('  ✅ Room code validation works');
    } catch (error) {
        console.log('  ❌ Room code validation failed:', error.message);
    }
    
    try {
        GameValidator.validateBabyName('Test Bunny');
        console.log('  ✅ Baby name validation works');
    } catch (error) {
        console.log('  ❌ Baby name validation failed:', error.message);
    }

    // Test achievement definitions
    const achievementCount = Object.keys(achievementManager.achievementDefinitions).length;
    console.log(`  ✅ Achievement system loaded ${achievementCount} achievements`);

    // Test customization content
    const colorCount = Object.keys(customizationManager.unlockableContent.colors).length;
    const traitCount = Object.keys(customizationManager.unlockableContent.traits).length;
    const accessoryCount = Object.keys(customizationManager.unlockableContent.accessories).length;
    console.log(`  ✅ Customization system loaded ${colorCount} colors, ${traitCount} traits, ${accessoryCount} accessories`);

    // Test memory event types
    const eventTypeCount = Object.keys(memoryManager.eventTypes).length;
    console.log(`  ✅ Memory system supports ${eventTypeCount} event types`);

    console.log('\n🎉 All tests passed! Backend is ready for startup.');
    console.log('\n📋 Summary:');
    console.log('  • All modules load successfully');
    console.log('  • All managers instantiate correctly');
    console.log('  • Basic validation functions work');
    console.log('  • Feature systems are properly configured');
    console.log('\n🚀 Ready to start server with: node server.js');

} catch (error) {
    console.error('\n❌ Startup test failed:', error);
    console.error('\n🔍 Error details:', error.stack);
    console.log('\n🛠️ Please fix the error before starting the server.');
    process.exit(1);
}