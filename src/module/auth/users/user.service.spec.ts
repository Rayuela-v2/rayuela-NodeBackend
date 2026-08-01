import { PROFILE_LIMITS, UserService } from './user.service';
import { UserDao } from './user.dao';
import { User } from './user.entity';
import { Checkin } from '../../checkin/entities/checkin.entity';

describe('UserService', () => {
  let service: UserService;
  let userDao: jest.Mocked<UserDao>;

  beforeEach(() => {
    userDao = {
      findByEmailOrUsername: jest.fn(),
      findByGoogleId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      getUserById: jest.fn(),
      getAllByProjectId: jest.fn(),
      getUserByResetToken: jest.fn(),
    } as any;
    service = new UserService(userDao);
  });

  it('findByEmailOrUsername debe delegar en userDao', async () => {
    const user = { id: '1' } as User;
    userDao.findByEmailOrUsername.mockResolvedValue(user);
    const result = await service.findByEmailOrUsername('mail', 'user');
    expect(userDao.findByEmailOrUsername).toHaveBeenCalledWith('mail', 'user');
    expect(result).toBe(user);
  });

  it('create debe delegar en userDao', async () => {
    const user = { id: '1' } as User;
    userDao.create.mockResolvedValue(user);
    const result = await service.create(user);
    expect(userDao.create).toHaveBeenCalledWith(user);
    expect(result).toBe(user);
  });

  it('findByGoogleId debe delegar en userDao', async () => {
    const user = { id: '1' } as User;
    userDao.findByGoogleId.mockResolvedValue(user);
    const result = await service.findByGoogleId('google-id');
    expect(userDao.findByGoogleId).toHaveBeenCalledWith('google-id');
    expect(result).toBe(user);
  });

  it('update debe delegar en userDao', async () => {
    const user = { id: '1' } as User;
    userDao.update.mockResolvedValue(user);
    const result = await service.update('1', user);
    expect(userDao.update).toHaveBeenCalledWith('1', user);
    expect(result).toBe(user);
  });

  it('getByUserId debe delegar en userDao', async () => {
    const user = { id: '1' } as User;
    userDao.getUserById.mockResolvedValue(user);
    const result = await service.getByUserId('1');
    expect(userDao.getUserById).toHaveBeenCalledWith('1');
    expect(result).toBe(user);
  });

  it('findAllByProjectId debe delegar en userDao', async () => {
    const users = [{ id: '1' }] as User[];
    userDao.getAllByProjectId.mockResolvedValue(users);
    const result = await service.findAllByProjectId('p1');
    expect(userDao.getAllByProjectId).toHaveBeenCalledWith('p1');
    expect(result).toBe(users);
  });

  it('saveResetToken debe actualizar el resetToken y llamar a update', async () => {
    const user = { id: '1', resetToken: '' } as User;
    userDao.getUserById.mockResolvedValue(user);
    userDao.update.mockResolvedValue(user);
    await service.saveResetToken('1', 'token123');
    expect(userDao.getUserById).toHaveBeenCalledWith('1');
    expect(user.resetToken).toBe('token123');
    expect(userDao.update).toHaveBeenCalledWith('1', user);
  });

  it('rate debe agregar rating y actualizar el usuario', async () => {
    const user = { id: '1', addRating: jest.fn() } as unknown as User;
    userDao.getUserById.mockResolvedValue(user);
    userDao.update.mockResolvedValue(user);
    const checkin = {} as Checkin;
    const result = await service.rate('1', checkin, 5);
    expect(userDao.getUserById).toHaveBeenCalledWith('1');
    expect(user.addRating).toHaveBeenCalledWith(checkin, 5);
    expect(userDao.update).toHaveBeenCalledWith('1', user);
    expect(result).toBe(user);
  });

  it('rate debe lanzar error si el usuario no existe', async () => {
    userDao.getUserById.mockResolvedValue(null);
    await expect(service.rate('1', {} as Checkin, 5)).rejects.toThrow(
      'User not found',
    );
  });

  describe('updateProfile', () => {
    const makeUser = () =>
      new User('Nombre Viejo', 'user', 'a@b.com', 'hash', 'avatar:explorador');

    it('solo pisa los campos presentes en el patch', async () => {
      const user = makeUser();
      user.description = 'bio vieja';
      userDao.findByEmailOrUsername.mockResolvedValue(user);
      userDao.update.mockImplementation(async (_id, u) => u);

      await service.updateProfile('user', { complete_name: '  Ana Paz  ' });

      expect(user.completeName).toBe('Ana Paz');
      expect(user.description).toBe('bio vieja');
      expect(user.profileImage).toBe('avatar:explorador');
    });

    it('recorta la descripción al límite e ignora un nombre vacío', async () => {
      const user = makeUser();
      userDao.findByEmailOrUsername.mockResolvedValue(user);
      userDao.update.mockImplementation(async (_id, u) => u);

      await service.updateProfile('user', {
        complete_name: '   ',
        description: 'x'.repeat(PROFILE_LIMITS.description + 50),
      });

      expect(user.completeName).toBe('Nombre Viejo');
      expect(user.description).toHaveLength(PROFILE_LIMITS.description);
    });

    it('un profile_image vacío limpia el avatar', async () => {
      const user = makeUser();
      userDao.findByEmailOrUsername.mockResolvedValue(user);
      userDao.update.mockImplementation(async (_id, u) => u);

      await service.updateProfile('user', { profile_image: '' });

      expect(user.profileImage).toBeNull();
    });

    it('falla si el usuario no existe', async () => {
      userDao.findByEmailOrUsername.mockResolvedValue(null);
      await expect(service.updateProfile('user', {})).rejects.toThrow(
        'User not found',
      );
    });
  });

  it('getUserByResetToken debe delegar en userDao', () => {
    userDao.getUserByResetToken.mockReturnValue(
      Promise.resolve({ id: '1' } as User),
    );
    const result = service.getUserByResetToken('token');
    expect(userDao.getUserByResetToken).toHaveBeenCalledWith('token');
    expect(result).toEqual(Promise.resolve({ id: '1' } as User));
  });
});
