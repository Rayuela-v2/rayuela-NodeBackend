import { Task } from './task.entity';
import { Checkin } from '../../checkin/entities/checkin.entity';
import { TimeInterval } from './time-restriction.entity';
import { GeoUtils } from '../utils/geoUtils';
import { Feature } from '../../project/dto/create-project.dto';

jest.mock('../utils/geoUtils'); // Mock de GeoUtils para controlar su comportamiento

describe('Task', () => {
  let task: Task;
  let taskTimeRestriction: TimeInterval;
  let area: Feature;
  let checkin: Checkin;

  beforeEach(() => {
    taskTimeRestriction = new TimeInterval(
      '',
      [1, 3, 5],
      {
        start: '13:00:00',
        end: '19:00:00',
      },
      new Date('2024-01-01T00:00:00.000Z'),
      new Date('2024-12-31T23:59:59.999Z'),
      'America/Argentina/Buenos_Aires',
    ); // Lunes, Miércoles y Viernes de 13 a 19 en Buenos Aires
    area = {
      type: 'Feature',
      properties: {
        cid: '',
        pos: '',
        gid: '',
        source_object: '',
        source_gna: '',
        id: 'area 0',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-73.9876, 40.7661],
            [-73.9876, 40.7658],
            [-73.9873, 40.7658],
            [-73.9873, 40.7661],
            [-73.9876, 40.7661],
          ],
        ],
      },
    }; // Área simulada en formato GeoJSON

    task = new Task(
      'id',
      'Test Task',
      'Test Description',
      'project123',
      taskTimeRestriction,
      area,
      'type',
    );

    checkin = new Checkin(
      '40.7659',
      '-73.9875',
      new Date('2024-09-16T15:00:00-03:00'),
      'project123',
      null,
      'type',
      'id',
    );
  });

  it('should initialize with correct values', () => {
    expect(task.projectId).toBe('project123');
    expect(task.accept).toBeDefined();
  });

  describe('accept method', () => {
    it('should return true when all validations pass', () => {
      (GeoUtils.isPointInPolygon as jest.Mock).mockReturnValue(true);

      const result = task.accept(checkin);

      expect(result).toBe(true);
    });

    it('should return false if the checkin is for a different project', () => {
      checkin.projectId = 'wrongProject';

      const result = task.accept(checkin);

      expect(result).toBe(false);
    });

    it('should return false if the checkin is outside the time restriction', () => {
      // Cambiamos la fecha del checkin a una que esté fuera de las restricciones de tiempo
      checkin.date = new Date('2024-09-16T20:00:00-03:00'); // Lunes a las 20:00, fuera del rango de 13-19

      const result = task.accept(checkin);

      expect(result).toBe(false);
    });

    it('should return false if the checkin is outside the valid area', () => {
      // Mock GeoUtils.isPointInPolygon to return false for the checkin coordinates
      (GeoUtils.isPointInPolygon as jest.Mock).mockReturnValue(false);

      const result = task.accept(checkin);

      expect(result).toBe(false);
    });
  });

  describe('isSameProject method', () => {
    it('should return true if the project IDs match', () => {
      const result = (task as any).isSameProject(checkin);
      expect(result).toBe(true);
    });

    it('should return false if the project IDs do not match', () => {
      checkin.projectId = 'wrongProject';
      const result = (task as any).isSameProject(checkin);
      expect(result).toBe(false);
    });
  });

  describe('isValidTimeRestriction method', () => {
    it('should return true if the date satisfies the time restriction', () => {
      const result = (task as any).isValidTimeRestriction(checkin.date);
      expect(result).toBe(true);
    });

    it('should return false if the date does not satisfy the time restriction', () => {
      checkin.date = new Date('2024-09-16T20:00:00-03:00'); // Lunes a las 20:00, fuera del rango
      const result = (task as any).isValidTimeRestriction(checkin.date);
      expect(result).toBe(false);
    });
  });

  describe('idValidArea method', () => {
    it('should return true if the checkin is inside the valid area', () => {
      (GeoUtils.isPointInPolygon as jest.Mock).mockReturnValue(true);
      const result = (task as any).isValidArea(checkin);
      expect(result).toBe(true);
    });

    it('should return false if the checkin is outside the valid area', () => {
      (GeoUtils.isPointInPolygon as jest.Mock).mockReturnValue(false);
      const result = (task as any).isValidArea(checkin);
      expect(result).toBe(false);
    });
  });

  it('should manage solved state', () => {
    expect(task.solved).toBe(false);
    task.setSolved(true);
    expect(task.solved).toBe(true);
  });

  it('should test contributesToCheckin', () => {
    (GeoUtils.isPointInPolygon as jest.Mock).mockReturnValue(true);
    task.setSolved(false);
    expect(task.contributesToCheckin(checkin)).toBe(true);

    task.setSolved(true);
    expect(task.contributesToCheckin(checkin)).toBe(false);

    task.setSolved(false);
    (GeoUtils.isPointInPolygon as jest.Mock).mockReturnValue(false);
    expect(task.contributesToCheckin(checkin)).toBe(false);
  });

  it('should test toJSON and getters', () => {
    expect(task.timeInterval).toBe(taskTimeRestriction);
    expect(task.type).toBe('type');
    expect(task.areaGeoJSON).toBe(area);
    expect(task.description).toBe('Test Description');
    expect(task.name).toBe('Test Task');
    expect(task.getId()).toBe('id');
    expect(task.toJSON().id).toBe('id');
  });

  it('should return false in accept if areaGeoJSON is missing', () => {
    const taskNoArea = new Task(
      'id',
      'name',
      'desc',
      'p',
      {} as any,
      null,
      'type',
    );
    expect(taskNoArea.accept(checkin)).toBe(false);
  });
});
