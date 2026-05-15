// src/utils/seedData.js
const Disaster    = require('../models/Disaster');
const SosReport   = require('../models/SosReport');
const Shelter     = require('../models/Shelter');
const Resource    = require('../models/Resource');
const Alert       = require('../models/Alert');
const SocialPost  = require('../models/SocialPost');
const RescueRoute = require('../models/RescueRoute');
const User        = require('../models/User');

// Helper: generate a GeoJSON LineString between two points with intermediate waypoints
const makeRouteGeoJSON = (origin, dest, midpoints = []) => ({
  type: 'LineString',
  coordinates: [origin, ...midpoints, dest],
});

const seedDatabase = async () => {
  try {
    // ── Check if already seeded ──────────────────────────────────
    const existingDisasters = await Disaster.countDocuments();
    if (existingDisasters > 0) {
      console.log('🌱 Database already seeded — skipping');
      return;
    }

    console.log('🌱 Seeding database with demo data...');

    // ── Admin User (plain password — pre-save hook will hash it) ────
    const admin = await User.create({
      name:         'RESQAI Command',
      email:        'admin@resqai.in',
      password:     'admin123',
      role:         'admin',
      organisation: 'RESQAI Operations',
    });
    const responder = await User.create({
      name:         'Field Responder',
      email:        'responder@resqai.in',
      password:     'admin123',
      role:         'responder',
      organisation: 'NDRF Team Alpha',
    });
    await User.create({
      name:         'Demo Citizen',
      email:        'citizen@resqai.in',
      password:     'citizen123',
      role:         'citizen',
      organisation: 'Public',
    });
    console.log('  ✅ Users created (admin@resqai.in / admin123, citizen@resqai.in / citizen123)');

    // ── Disasters ──────────────────────────────────────────────────
    const disasters = await Disaster.insertMany([
      {
        type: 'flood',
        title: 'Mumbai Coastal Flooding — Dharavi & Kurla',
        description: 'Severe flooding in low-lying areas due to record monsoon rainfall. Yamuna tributaries overflowing. Residential areas submerged up to 4 feet.',
        severity: 'critical',
        status: 'active',
        location: { type: 'Point', coordinates: [72.8777, 19.0760] },
        affectedRadius: 12,
        affectedPeople: 15400,
        riskScore: 94,
        weatherData: { rainfall: 185, windSpeed: 35, temperature: 29 },
        reportedBy: admin._id,
        isVerified: true,
        tags: ['flood', 'monsoon', 'urban', 'critical'],
      },
      {
        type: 'cyclone',
        title: 'Cyclone Vayu — Approaching Chennai Coast',
        description: 'Category 3 cyclone making landfall within 18 hours. Storm surge expected 2–3m. Mandatory evacuation ordered for coastal belt.',
        severity: 'critical',
        status: 'active',
        location: { type: 'Point', coordinates: [80.2707, 13.0827] },
        affectedRadius: 25,
        affectedPeople: 22000,
        riskScore: 91,
        weatherData: { rainfall: 220, windSpeed: 140, temperature: 31 },
        reportedBy: admin._id,
        isVerified: true,
        tags: ['cyclone', 'coastal', 'evacuation', 'storm-surge'],
      },
      {
        type: 'urban',
        title: 'Industrial Fire — Okhla Industrial Zone, Delhi',
        description: 'Major chemical plant fire with toxic gas leak. 500m exclusion zone established. Air quality index hazardous (AQI 480+).',
        severity: 'high',
        status: 'active',
        location: { type: 'Point', coordinates: [77.2900, 28.5355] },
        affectedRadius: 5,
        affectedPeople: 3800,
        riskScore: 78,
        weatherData: { rainfall: 0, windSpeed: 18, temperature: 42 },
        reportedBy: admin._id,
        isVerified: true,
        tags: ['fire', 'chemical', 'urban', 'evacuation'],
      },
      {
        type: 'earthquake',
        title: 'Seismic Activity — Dehradun, Uttarakhand',
        description: 'Magnitude 5.1 earthquake. Multiple aftershocks reported. Building collapses in older residential areas.',
        severity: 'high',
        status: 'monitoring',
        location: { type: 'Point', coordinates: [78.0322, 30.3165] },
        affectedRadius: 20,
        affectedPeople: 6200,
        riskScore: 72,
        weatherData: { rainfall: 0, windSpeed: 12, temperature: 24 },
        reportedBy: admin._id,
        isVerified: true,
        tags: ['earthquake', 'building-collapse', 'rescue'],
      },
    ]);
    console.log(`  ✅ ${disasters.length} disasters created`);

    const [floodDis, cycloneDis, urbanDis] = disasters;

    // ── Shelters ───────────────────────────────────────────────────
    const shelters = await Shelter.insertMany([
      {
        name: 'Bandra Relief Camp',
        address: 'Bandra Kurla Complex, Mumbai, Maharashtra',
        location: { type: 'Point', coordinates: [72.8656, 19.0665] },
        capacity: 850,  occupancy: 612,
        status: 'open',
        facilities: ['food', 'water', 'medical', 'power'],
        contactPhone: '+91-22-26550001',
        disasterTypes: ['flood', 'cyclone'],
        managedBy: responder._id,
      },
      {
        name: 'Dharavi Community Center',
        address: 'Dharavi Main Road, Mumbai',
        location: { type: 'Point', coordinates: [72.8520, 19.0435] },
        capacity: 500, occupancy: 488,
        status: 'full',
        facilities: ['food', 'water', 'medical'],
        contactPhone: '+91-22-24041002',
        disasterTypes: ['flood'],
        managedBy: responder._id,
      },
      {
        name: 'Chennai Marina Evacuation Hub',
        address: 'Anna Salai, Chennai, Tamil Nadu',
        location: { type: 'Point', coordinates: [80.2785, 13.0878] },
        capacity: 2000, occupancy: 1320,
        status: 'open',
        facilities: ['food', 'water', 'medical', 'power', 'wifi'],
        contactPhone: '+91-44-25330033',
        disasterTypes: ['cyclone'],
        managedBy: admin._id,
      },
      {
        name: 'Besant Nagar Relief Zone',
        address: 'Besant Nagar, Chennai',
        location: { type: 'Point', coordinates: [80.2707, 13.0005] },
        capacity: 600, occupancy: 201,
        status: 'open',
        facilities: ['food', 'water', 'power'],
        contactPhone: '+91-44-24464005',
        disasterTypes: ['cyclone', 'flood'],
        managedBy: admin._id,
      },
      {
        name: 'Okhla Emergency Relief Point',
        address: 'Okhla Phase II, New Delhi',
        location: { type: 'Point', coordinates: [77.2750, 28.5302] },
        capacity: 300, occupancy: 87,
        status: 'open',
        facilities: ['water', 'medical', 'power'],
        contactPhone: '+91-11-26843001',
        disasterTypes: ['urban'],
        managedBy: responder._id,
      },
    ]);
    console.log(`  ✅ ${shelters.length} shelters created`);

    // ── SOS Reports ────────────────────────────────────────────────
    const sosReports = await SosReport.insertMany([
      { senderId: 'device-001', senderName: 'Ramesh Kumar', message: 'URGENT! House completely flooded. Family of 4 stuck on rooftop at Dharavi. Water level 5 feet. Need boat rescue immediately!', location: { type: 'Point', coordinates: [72.8520, 19.0440] }, channel: 'online', urgencyScore: 0.97, disasterType: 'flood', status: 'pending' },
      { senderId: 'device-002', senderName: 'Priya Sharma', message: 'Elderly woman with diabetes needs insulin. Trapped in ground floor, water rising. Mahim area, near railway station.', location: { type: 'Point', coordinates: [72.8417, 19.0391] }, channel: 'online', urgencyScore: 0.92, disasterType: 'flood', status: 'pending' },
      { senderId: 'device-003', senderName: 'Mohammed Irfan', message: 'Government school compound has 200 people. No food or water for 18 hours. Children and elderly present. Kurla West.', location: { type: 'Point', coordinates: [72.8810, 19.0728] }, channel: 'online', urgencyScore: 0.88, disasterType: 'flood', status: 'acknowledged', assignedTeam: responder._id },
      { senderId: 'device-004', senderName: 'Anita Patel', message: 'BLE relay from Dharavi - original sender device-007. Multiple families need rescue. No internet connectivity.', location: { type: 'Point', coordinates: [72.8490, 19.0380] }, channel: 'ble', hops: 3, relayChain: ['device-007', 'device-009', 'device-004'], urgencyScore: 0.85, disasterType: 'flood', status: 'pending' },
      { senderId: 'device-005', senderName: 'Coastal Resident', message: 'Cyclone approaching fast. My fishing village has 60 people who cannot evacuate - no transport. Medical attention needed for 2 injured.', location: { type: 'Point', coordinates: [80.2850, 13.1050] }, channel: 'online', urgencyScore: 0.95, disasterType: 'cyclone', status: 'pending' },
      { senderId: 'device-006', senderName: 'Vijay Narayanan', message: 'Storm surge hit already. 3 feet water in residential area. Elderly couple on first floor, need immediate evacuation.', location: { type: 'Point', coordinates: [80.2900, 13.0700] }, channel: 'online', urgencyScore: 0.90, disasterType: 'cyclone', status: 'pending' },
      { senderId: 'device-008', senderName: 'Marina Resident', message: 'WiFi Direct relay - multiple houses collapsed near beach road. 5 people trapped under debris. Send rescue team.', location: { type: 'Point', coordinates: [80.2750, 13.0600] }, channel: 'wifi-direct', hops: 2, relayChain: ['device-010', 'device-008'], urgencyScore: 0.96, disasterType: 'cyclone', status: 'pending' },
      { senderId: 'device-011', senderName: 'Factory Worker', message: 'Chemical leak from Plant B. Toxic fumes spreading. 15 workers still inside. Need hazmat team. Burning sensation in eyes.', location: { type: 'Point', coordinates: [77.2910, 28.5360] }, channel: 'online', urgencyScore: 0.99, disasterType: 'urban', status: 'acknowledged', assignedTeam: responder._id },
      { senderId: 'device-012', senderName: 'Security Guard', message: 'Main gate blocked by fire. Workers trapped in Zone C. Fire spreading toward chemical storage. URGENT HELP.', location: { type: 'Point', coordinates: [77.2880, 28.5340] }, channel: 'online', urgencyScore: 0.97, disasterType: 'urban', status: 'pending' },
      { senderId: 'device-013', senderName: 'Neighbor', message: 'Mesh network relay - cannot breathe. Fumes spreading to neighboring blocks. Children being evacuated but no bus available.', location: { type: 'Point', coordinates: [77.2850, 28.5380] }, channel: 'mesh', hops: 4, relayChain: ['dev-A','dev-B','dev-C','dev-013'], urgencyScore: 0.88, disasterType: 'urban', status: 'pending' },
    ]);
    console.log(`  ✅ ${sosReports.length} SOS reports created`);

    // ── Social Posts (NLP pre-processed) ──────────────────────────
    await SocialPost.insertMany([
      { platform: 'twitter', text: 'HELP! Entire street submerged in Dharavi. Water reaching 2nd floor windows. Need boats. #MumbaiFLOOD', author: 'ramesh_k', urgencyScore: 0.94, sentimentScore: -0.89, isSOS: true, disasterType: 'flood', extractedLocation: 'Dharavi, Mumbai', keywords: ['submerged','boats','flood'], nlpProcessed: true, isMisinformation: false },
      { platform: 'twitter', text: 'Cyclone Vayu is FAKE NEWS spread by opposition. Government manufactured this to distract people from economy crisis. DO NOT EVACUATE.', author: 'troll_acct', urgencyScore: 0.08, sentimentScore: 0.3, isSOS: false, disasterType: 'cyclone', nlpProcessed: true, isMisinformation: true, keywords: ['fake','manufactured','opposition'] },
      { platform: 'manual', text: 'Confirmed: Storm surge 2.5m at Marina Beach. Boats swept. Road blocked. Please send rescue to Thiruvanmiyur area immediately.', author: 'ndrf_volunteer', urgencyScore: 0.91, sentimentScore: -0.85, isSOS: true, disasterType: 'cyclone', extractedLocation: 'Marina Beach, Chennai', keywords: ['storm','surge','boats','rescue'], nlpProcessed: true },
      { platform: 'telegram', text: 'Okhla factory fire spreading. Toxic smoke visible from 5km. People running on NH48. Government helpline busy. Is anyone coordinating??', author: 'delhi_reporter', urgencyScore: 0.82, sentimentScore: -0.76, isSOS: false, disasterType: 'urban', extractedLocation: 'Okhla, Delhi', keywords: ['toxic','smoke','fire','helpline'], nlpProcessed: true },
      { platform: 'twitter', text: 'Mumbai flood updates: IMD confirms 350mm rainfall in 6 hours. Red alert issued. BEST bus services suspended. Metro disrupted. Stay home if possible.', author: 'imd_official', urgencyScore: 0.65, sentimentScore: -0.55, isSOS: false, disasterType: 'flood', extractedLocation: 'Mumbai', keywords: ['rainfall','red alert','metro','IMD'], nlpProcessed: true },
      { platform: 'twitter', text: 'My grandmother trapped in Kurla. Ground floor submerged. She has heart condition and no medication. Please help +91-9988776655 #SOS', author: 'worried_citizen', urgencyScore: 0.96, sentimentScore: -0.92, isSOS: true, disasterType: 'flood', extractedLocation: 'Kurla, Mumbai', keywords: ['grandmother','trapped','heart','medication','SOS'], nlpProcessed: true },
      { platform: 'telegram', text: 'Ghost Network relay from Dharavi sector 7: 3 families (12 people) on terrace. No internet since 6 hours. Battery low on relaying device.', author: 'mesh_relay_node', urgencyScore: 0.93, sentimentScore: -0.88, isSOS: true, disasterType: 'flood', extractedLocation: 'Dharavi Sector 7', keywords: ['terrace','internet','battery','relay'], nlpProcessed: true },
      { platform: 'twitter', text: 'BREAKING: Cyclone Vayu officially upgraded to Category 3. 140kmph winds expected at landfall. Coastal Tamil Nadu on highest alert. IMD update.', author: 'imd_official', urgencyScore: 0.72, sentimentScore: -0.60, isSOS: false, disasterType: 'cyclone', extractedLocation: 'Tamil Nadu Coast', keywords: ['cyclone','category3','landfall','winds'], nlpProcessed: true },
      { platform: 'manual', text: 'DO NOT PANIC: Okhla fire is under control per Fire dept. Chemical leak contained. AQI improving. Wind blowing away from residential. Monitoring.', author: 'delhi_fire_dept', urgencyScore: 0.35, sentimentScore: 0.25, isSOS: false, disasterType: 'urban', extractedLocation: 'Okhla, Delhi', keywords: ['control','contained','monitoring'], nlpProcessed: true },
      { platform: 'twitter', text: 'Volunteers needed urgently at Bandra KWB relief center. 600+ people need food, blankets. Especially need medical professionals. DM for address.', author: 'volunteer_coordinator', urgencyScore: 0.78, sentimentScore: -0.65, isSOS: false, disasterType: 'flood', extractedLocation: 'Bandra, Mumbai', keywords: ['volunteers','food','blankets','medical'], nlpProcessed: true },
    ]);
    console.log(`  ✅ Social posts created`);

    // ── Resources ──────────────────────────────────────────────────
    await Resource.insertMany([
      { name: 'NDRF Rescue Boats (Fleet A)', category: 'vehicle', quantity: 8, unit: 'boats', status: 'deployed', assignedTo: floodDis._id, deployedAt: new Date() },
      { name: 'Emergency Medical Kits', category: 'medical', quantity: 250, unit: 'kits', status: 'available', location: { type: 'Point', coordinates: [72.8656, 19.0665] } },
      { name: 'Water Tankers', category: 'water', quantity: 15, unit: 'tankers', status: 'deployed', assignedTo: cycloneDis._id, deployedAt: new Date() },
      { name: 'Hazmat Response Team', category: 'personnel', quantity: 24, unit: 'personnel', status: 'deployed', assignedTo: urbanDis._id, deployedAt: new Date() },
      { name: 'Rescue Helicopters', category: 'vehicle', quantity: 3, unit: 'helicopters', status: 'available', location: { type: 'Point', coordinates: [72.8777, 19.0760] } },
      { name: 'Food Supply Packets', category: 'food', quantity: 5000, unit: 'packets', status: 'available', location: { type: 'Point', coordinates: [80.2707, 13.0827] } },
    ]);
    console.log(`  ✅ Resources created`);

    // ── Rescue Routes ──────────────────────────────────────────────
    await RescueRoute.insertMany([
      {
        name: 'Route α — Dharavi Rescue Corridor',
        origin:      { type: 'Point', coordinates: [72.8656, 19.0665] },
        destination: { type: 'Point', coordinates: [72.8520, 19.0440] },
        geoJSON: makeRouteGeoJSON([72.8656, 19.0665], [72.8520, 19.0440], [[72.8610, 19.0580], [72.8560, 19.0510]]),
        distanceKm:  4.2,
        durationMin: 18,
        safetyScore: 82,
        status: 'active',
        disasterId:  floodDis._id,
        blockedRoads: [{ lat: 19.051, lng: 72.857, reason: 'Waterlogged — impassable' }],
      },
      {
        name: 'Route β — Marina Evacuation Highway',
        origin:      { type: 'Point', coordinates: [80.2785, 13.0878] },
        destination: { type: 'Point', coordinates: [80.2700, 13.0500] },
        geoJSON: makeRouteGeoJSON([80.2785, 13.0878], [80.2700, 13.0500], [[80.2760, 13.0780], [80.2730, 13.0640]]),
        distanceKm:  6.8,
        durationMin: 24,
        safetyScore: 71,
        status: 'active',
        disasterId:  cycloneDis._id,
        blockedRoads: [{ lat: 13.072, lng: 80.274, reason: 'Storm debris on road' }],
      },
      {
        name: 'Route γ — Okhla Industrial Evacuation',
        origin:      { type: 'Point', coordinates: [77.2900, 28.5355] },
        destination: { type: 'Point', coordinates: [77.2750, 28.5302] },
        geoJSON: makeRouteGeoJSON([77.2900, 28.5355], [77.2750, 28.5302], [[72.285, 28.533]]),
        distanceKm:  2.1,
        durationMin: 9,
        safetyScore: 88,
        status: 'active',
        disasterId:  urbanDis._id,
        blockedRoads: [],
      },
    ]);
    console.log(`  ✅ Rescue routes created`);

    // ── Alerts ─────────────────────────────────────────────────────
    await Alert.insertMany([
      { title: '🚨 RED ALERT: Critical Flood — Mumbai', body: 'Severe flooding in Dharavi, Kurla, Mahim. Immediate evacuation ordered for Zone 3. Proceed to nearest shelter. Avoid all low-lying areas.', type: 'evacuation', severity: 'critical', targetTopics: ['all-users', 'flood-mumbai'], disasterId: floodDis._id, createdBy: admin._id, sentAt: new Date(), sentCount: 12400 },
      { title: '⚠️ CYCLONE WARNING — Chennai Coast', body: 'Cyclone Vayu landfall expected in 18 hours. Mandatory evacuation of coastal belt (5km). Shelters operational at Marina Hub and Besant Nagar.', type: 'evacuation', severity: 'warning', targetTopics: ['all-users', 'cyclone-chennai'], disasterId: cycloneDis._id, createdBy: admin._id, sentAt: new Date(Date.now() - 3600000), sentCount: 18200 },
      { title: '☣️ Chemical Hazard — Okhla Delhi', body: 'Toxic gas leak at Okhla Industrial Zone. 500m exclusion zone. Do NOT enter area. Wear masks. Wind direction: NE. Move to SW direction.', type: 'disaster', severity: 'critical', targetTopics: ['all-users', 'urban-delhi'], disasterId: urbanDis._id, createdBy: admin._id, sentAt: new Date(Date.now() - 7200000), sentCount: 4800 },
    ]);
    console.log(`  ✅ Alerts created`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('   👤 Logins: admin@resqai.in / admin123 · responder@resqai.in / admin123 · citizen@resqai.in / citizen123');
    console.log('   🌍 Disasters: Mumbai Flood, Chennai Cyclone, Delhi Urban Fire');
    console.log('   📍 10 SOS Reports | 5 Shelters | 3 Routes | 6 Resources\n');

  } catch (err) {
    console.error('❌ Seeding error:', err.message);
  }
};

module.exports = seedDatabase;
