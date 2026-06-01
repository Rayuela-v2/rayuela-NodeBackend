import { User } from '../../auth/users/user.entity';
import { Checkin } from '../entities/checkin.entity';
import { CheckInTemplate } from './checkin.schema';

export class CheckinMapper {
  /**
   * Transforma una entidad Checkin a su template para persistencia (CheckInTemplate)
   * @param checkin Instancia de la entidad Checkin
   * @returns Una instancia de CheckInTemplate con los datos mapeados
   */
  static toTemplate(checkin: Checkin): CheckInTemplate {
    return new CheckInTemplate(
      checkin.latitude,
      checkin.longitude,
      checkin.date,
      checkin.projectId,
      checkin.user.id,
      checkin.contributesTo,
      checkin.taskType,
      checkin.imageRefs,
    );
  }

  /**
   * Transforma un template (CheckInTemplate) a la entidad de dominio Checkin
   * @param template Instancia de CheckInTemplate obtenida de la base de datos
   * @param user Instancia completa del usuario asociado
   * @returns Una instancia de Checkin con los datos mapeados
   */
  static toEntity(template: any, user: User): Checkin {
    // Handle migration from imageRef to imageRefs
    let imageRefs = template.imageRefs || [];
    if (imageRefs.length === 0 && template.imageRef) {
      imageRefs = [template.imageRef];
    }

    const checkin = new Checkin(
      template.latitude,
      template.longitude,
      template.datetime,
      template.projectId,
      user,
      template.taskType,
      template._id,
      null,
      imageRefs,
    );

    // Si el template tiene información de contributesTo, se actualiza en la entidad
    if (template.contributesTo) {
      checkin.validateContribution(template.contributesTo);
    }
    return checkin;
  }
}
