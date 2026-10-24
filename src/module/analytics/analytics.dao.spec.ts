import { AnalyticsDao } from './analytics.dao';

describe('AnalyticsDao', () => {
  let dao: AnalyticsDao;
  let checkinModel: any;
  let moveModel: any;
  let projectModel: any;
  let userModel: any;
  let taskModel: any;

  beforeEach(() => {
    checkinModel = {
      aggregate: jest.fn().mockResolvedValue([]),
      countDocuments: jest.fn().mockResolvedValue(0),
      distinct: jest.fn().mockResolvedValue([]),
    };
    moveModel = {
      aggregate: jest.fn().mockResolvedValue([]),
    };
    projectModel = {};
    userModel = {};
    taskModel = {};

    dao = new AnalyticsDao(
      checkinModel,
      moveModel,
      projectModel,
      userModel,
      taskModel,
    );
  });

  describe('byStrategy', () => {
    it('filters by projectId and datetime range when provided and sorts by projectName', async () => {
      await dao.byStrategy('proj-1', '2026-10-01', '2026-10-24');

      expect(checkinModel.aggregate).toHaveBeenCalledTimes(1);
      const pipeline = checkinModel.aggregate.mock.calls[0][0];

      expect(pipeline[0]).toEqual({ $match: { projectId: 'proj-1' } });
      expect(pipeline[1]).toHaveProperty('$match.datetime.$gte');
      expect(pipeline[1]).toHaveProperty('$match.datetime.$lte');
      expect(pipeline[pipeline.length - 1]).toEqual({
        $sort: { projectName: 1 },
      });
    });
  });

  describe('contributionRate', () => {
    it('filters by projectId and datetime range when provided and sorts by projectName', async () => {
      await dao.contributionRate('proj-1', '2026-10-01', '2026-10-24');

      expect(checkinModel.aggregate).toHaveBeenCalledTimes(1);
      const pipeline = checkinModel.aggregate.mock.calls[0][0];

      expect(pipeline[0]).toEqual({ $match: { projectId: 'proj-1' } });
      expect(pipeline[1]).toHaveProperty('$match.datetime.$gte');
      expect(pipeline[1]).toHaveProperty('$match.datetime.$lte');
      expect(pipeline[pipeline.length - 1]).toEqual({
        $sort: { projectName: 1 },
      });
    });
  });

  describe('summary', () => {
    it('passes startDate and endDate to contributionRate so overallContributionRate respects the date filter', async () => {
      const spy = jest
        .spyOn(dao, 'contributionRate')
        .mockResolvedValue([
          {
            projectId: 'p1',
            projectName: 'P1',
            total: 4,
            withContribution: 3,
            rate: 0.75,
          },
        ]);

      const result = await dao.summary('p1', '2026-10-01', '2026-10-24');

      expect(spy).toHaveBeenCalledWith('p1', '2026-10-01', '2026-10-24');
      expect(result.overallContributionRate).toBe(0.75);
    });
  });

  describe('pointsOverTime & badgeAcquisitionOverTime', () => {
    it('buckets pointsOverTime by checkin.datetime so deferred/offline checkins align with checkinsOverTime', async () => {
      await dao.pointsOverTime('p1', 'day', '2026-10-01', '2026-10-24');

      const pipeline = moveModel.aggregate.mock.calls[0][0];
      const matchStages = pipeline.filter((s: any) => s.$match);
      expect(matchStages).toEqual(
        expect.arrayContaining([
          { $match: { 'checkin.projectId': 'p1' } },
          expect.objectContaining({
            $match: {
              'checkin.datetime': expect.objectContaining({
                $gte: expect.any(Date),
                $lte: expect.any(Date),
              }),
            },
          }),
        ]),
      );
    });
  });
});
