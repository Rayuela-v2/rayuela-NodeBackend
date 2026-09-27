const mongoose = require('mongoose');

async function seed() {
  const uri = 'mongodb://root:root@localhost:27017/test?authSource=admin';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const projectId = '6a41715197daf01ca5f165a1';

  const user1Id = '69e5380f74e107bfe7043f89';
  const user2Id = '69e5380f74e107bfe7043f8a';
  const user3Id = '69e5380f74e107bfe7043f8b';

  const taskZoneA = '6a6e4974d1dceac3868c5b7e';
  const taskZoneB = '6a6e4974d1dceac3868c5b7f';
  const taskZoneC = '6a6e4974d1dceac3868c5b80';
  const taskZoneD = '6a6e4974d1dceac3868c5b81';

  // 1. Remove previous check-ins and moves for these users on this project
  const existingCheckins = await db.collection('checkins').find({
    projectId,
    userId: { $in: [user1Id, user2Id, user3Id] },
  }).toArray();

  const existingCheckinIds = existingCheckins.map(c => String(c._id));
  if (existingCheckinIds.length > 0) {
    await db.collection('moves').deleteMany({ checkinId: { $in: existingCheckinIds } });
    await db.collection('checkins').deleteMany({ _id: { $in: existingCheckins.map(c => c._id) } });
    console.log(`Cleaned up ${existingCheckinIds.length} existing checkins`);
  }

  // 2. Set up user gameProfiles
  const profiles = [
    {
      userId: user1Id,
      profile: {
        projectId,
        points: 25,
        badges: ['Badge Wellcome', 'Badge B'],
        active: true,
      },
    },
    {
      userId: user2Id,
      profile: {
        projectId,
        points: 35,
        badges: ['Badge Wellcome', 'Badge D Extra', 'Badge A'],
        active: true,
      },
    },
    {
      userId: user3Id,
      profile: {
        projectId,
        points: 15,
        badges: ['Badge Wellcome'],
        active: true,
      },
    },
  ];

  for (const p of profiles) {
    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(p.userId) },
      {
        $pull: { gameProfiles: { projectId } },
      }
    );
    await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(p.userId) },
      {
        $push: { gameProfiles: p.profile },
      }
    );
  }
  console.log('Updated user game profiles for 3 volunteers');

  // 3. Define the check-ins sequence over the last month (Sept 2026)
  const events = [
    // Welcome badges earned early September
    {
      userId: user1Id,
      taskId: taskZoneD,
      taskType: 'OBSERVACION',
      datetime: new Date('2026-09-02T10:00:00.000Z'),
      newBadges: ['Badge Wellcome'],
      score: 10,
    },
    {
      userId: user2Id,
      taskId: taskZoneD,
      taskType: 'OBSERVACION',
      datetime: new Date('2026-09-04T11:30:00.000Z'),
      newBadges: ['Badge Wellcome'],
      score: 10,
    },
    {
      userId: user3Id,
      taskId: taskZoneD,
      taskType: 'OBSERVACION',
      datetime: new Date('2026-09-06T09:15:00.000Z'),
      newBadges: ['Badge Wellcome'],
      score: 10,
    },

    // Zone B progress: user1 does 2 checkins in Zone B and earns Badge B
    {
      userId: user1Id,
      taskId: taskZoneB,
      taskType: 'OBSERVACION',
      datetime: new Date('2026-09-09T14:00:00.000Z'),
      newBadges: [],
      score: 5,
    },
    {
      userId: user1Id,
      taskId: taskZoneB,
      taskType: 'OBSERVACION',
      datetime: new Date('2026-09-14T15:30:00.000Z'),
      newBadges: ['Badge B'],
      score: 10,
    },

    // Badge D Extra earned by user2
    {
      userId: user2Id,
      taskId: taskZoneD,
      taskType: 'OBSERVACION',
      datetime: new Date('2026-09-12T12:00:00.000Z'),
      newBadges: ['Badge D Extra'],
      score: 10,
    },

    // Zone A progress: user2 does 2 checkins, user3 does 1 checkin
    {
      userId: user2Id,
      taskId: taskZoneA,
      taskType: 'OBSERVACION',
      datetime: new Date('2026-09-11T16:00:00.000Z'),
      newBadges: [],
      score: 5,
    },
    {
      userId: user3Id,
      taskId: taskZoneA,
      taskType: 'OBSERVACION',
      datetime: new Date('2026-09-17T10:20:00.000Z'),
      newBadges: [],
      score: 5,
    },
    {
      userId: user2Id,
      taskId: taskZoneA,
      taskType: 'OBSERVACION',
      datetime: new Date('2026-09-21T17:45:00.000Z'),
      newBadges: ['Badge A'],
      score: 10,
    },

    // Later check-in by user3 in Zone B (keeping interest alive in late September)
    {
      userId: user3Id,
      taskId: taskZoneB,
      taskType: 'OBSERVACION',
      datetime: new Date('2026-09-25T11:00:00.000Z'),
      newBadges: [],
      score: 5,
    },
  ];

  for (const ev of events) {
    const checkinDoc = {
      latitude: '-32.887915',
      longitude: '-68.82679',
      datetime: ev.datetime,
      projectId,
      userId: ev.userId,
      taskType: ev.taskType,
      contributesTo: ev.taskId,
      imageRefs: [],
      createdAt: ev.datetime,
      updatedAt: ev.datetime,
    };

    const inserted = await db.collection('checkins').insertOne(checkinDoc);
    const checkinId = inserted.insertedId.toString();

    const moveDoc = {
      checkinId,
      userId: ev.userId,
      score: ev.score,
      timestamp: ev.datetime,
      newBadges: ev.newBadges,
      newPoints: ev.score,
    };
    await db.collection('moves').insertOne(moveDoc);
  }

  console.log(`Inserted ${events.length} checkins and moves across the last month`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
